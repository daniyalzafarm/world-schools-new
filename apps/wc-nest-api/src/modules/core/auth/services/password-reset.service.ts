import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { EmailService } from '@world-schools/global-utils'
import * as crypto from 'crypto'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)
  private readonly TOKEN_EXPIRY_HOURS = 1
  private readonly MAX_RESET_ATTEMPTS_PER_HOUR = 3

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate a secure, URL-safe reset token
   */
  private generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Create and send password reset email
   */
  async createPasswordResetToken(email: string, role: 'superadmin' | 'provider'): Promise<void> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    // Don't reveal if user exists for security
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`)
      return
    }

    // Verify user has the appropriate role
    const hasRole =
      role === 'superadmin'
        ? user.roles.some(ur => ur.role.name === 'Super Admin')
        : user.roles.some(ur => ur.role.name === 'Provider Admin' || ur.role.providerId !== null)

    if (!hasRole) {
      this.logger.warn(`Password reset requested for user without ${role} role: ${email}`)
      return
    }

    // Check rate limiting - max 3 attempts per hour
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const recentAttempts = await this.prisma.passwordReset.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    })

    if (recentAttempts >= this.MAX_RESET_ATTEMPTS_PER_HOUR) {
      this.logger.warn(`Too many password reset attempts for user: ${email}`)
      throw new BadRequestException('Too many password reset attempts. Please try again later.')
    }

    // Delete any existing unused tokens for this user
    await this.prisma.passwordReset.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    })

    // Generate new token
    const token = this.generateResetToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS)

    // Save to database
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Determine frontend URL based on role
    const resetUrl =
      role === 'superadmin'
        ? `${this.configService.superadminPortalUrl}/auth/reset-password?token=${token}`
        : `${this.configService.providerPortalUrl}/auth/reset-password?token=${token}`

    // Send email
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Password Reset Request - World Schools',
      html: this.getPasswordResetEmailTemplate(
        user.firstName || 'User',
        resetUrl,
        this.TOKEN_EXPIRY_HOURS
      ),
    })

    if (!emailSent) {
      this.logger.error(`Failed to send password reset email to ${email}`)
      throw new BadRequestException('Failed to send password reset email. Please try again.')
    }

    this.logger.log(`Password reset email sent to ${email}`)
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    role: 'superadmin' | 'provider'
  ): Promise<void> {
    // Find the reset token
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    })

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    // Check if token has been used
    if (resetRecord.used) {
      throw new BadRequestException('This reset token has already been used')
    }

    // Check if token has expired
    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Reset token has expired. Please request a new one.')
    }

    // Verify user has the appropriate role
    const hasRole =
      role === 'superadmin'
        ? resetRecord.user.roles.some(ur => ur.role.name === 'Super Admin')
        : resetRecord.user.roles.some(
            ur => ur.role.name === 'Provider Admin' || ur.role.providerId !== null
          )

    if (!hasRole) {
      throw new BadRequestException('Unauthorized access')
    }

    // Hash the new password
    const saltRounds = this.configService.jwtConfig.bcryptSaltRounds
    const passwordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password and mark token as used in a transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ])

    this.logger.log(`Password reset successful for user: ${resetRecord.user.email}`)
  }

  /**
   * Get password reset email template
   */
  private getPasswordResetEmailTemplate(
    userName: string,
    resetUrl: string,
    expiryHours: number
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #4F46E5;
              color: white !important;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              margin: 15px 0;
            }
            .link {
              color: #4F46E5;
              word-break: break-all;
              font-size: 14px;
            }
            .security-notice {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
            }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We received a request to reset your password for your World Schools account. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p class="link">${resetUrl}</p>
              <div class="security-notice">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This link will expire in <strong>${expiryHours} hour${expiryHours > 1 ? 's' : ''}</strong></li>
                  <li>This link can only be used once</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password will remain unchanged until you create a new one</li>
                </ul>
              </div>
              <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
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
