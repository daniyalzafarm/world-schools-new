import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailService } from '@world-schools/global-utils'

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name)
  private readonly CODE_EXPIRY_MINUTES = 15
  private readonly MAX_RESEND_ATTEMPTS = 5

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Create and send verification code to user's email
   */
  async createAndSendVerificationCode(userId: string, email: string): Promise<void> {
    // Delete any existing unverified codes for this user
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        verified: false,
      },
    })

    // Generate new code
    const code = this.generateVerificationCode()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES)

    // Save to database
    await this.prisma.emailVerification.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    })

    // Send email
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Email Verification - World Schools',
      html: this.getVerificationEmailTemplate(code),
    })

    if (!emailSent) {
      this.logger.error(`Failed to send verification email to ${email}`)
      throw new BadRequestException('Failed to send verification email. Please try again.')
    }

    this.logger.log(`Verification code sent to ${email}`)
  }

  /**
   * Verify the code provided by user and return the verified user
   */
  async verifyCode(email: string, code: string): Promise<{ id: string; email: string }> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Find the verification record
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        code,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!verification) {
      throw new BadRequestException('Invalid verification code')
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.')
    }

    // Mark as verified
    await this.prisma.$transaction([
      // Mark verification as verified
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { verified: true },
      }),
      // Update user's email verification status
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ])

    this.logger.log(`Email verified for user ${user.email}`)
    return { id: user.id, email: user.email }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string): Promise<void> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Check if email is already verified
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified')
    }

    // Check recent attempts to prevent spam
    const recentAttempts = await this.prisma.emailVerification.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    })

    if (recentAttempts >= this.MAX_RESEND_ATTEMPTS) {
      throw new BadRequestException('Too many verification attempts. Please try again later.')
    }

    // Create and send new code
    await this.createAndSendVerificationCode(user.id, user.email)
  }

  /**
   * Email template for verification code
   */
  private getVerificationEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .code { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; letter-spacing: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Thank you for registering with World Schools!</p>
              <p>Please use the following verification code to complete your registration:</p>
              <div class="code">${code}</div>
              <p>This code will expire in ${this.CODE_EXPIRY_MINUTES} minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} World Schools. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}
