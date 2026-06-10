import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { randomInt } from 'crypto'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name)
  private readonly CODE_EXPIRY_MINUTES = 15
  private readonly MAX_RESEND_ATTEMPTS = 5
  private readonly RESEND_COOLDOWN_SECONDS = 30 // Cooldown period between resend attempts

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService
  ) {}

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString()
  }

  /**
   * Create and send verification code to user's email.
   * @param portalUrl - The base URL of the app portal (e.g. bookingPortalUrl or providerPortalUrl)
   * @param audience - Whether the recipient is a parent or a provider; selects the email copy
   */
  async createAndSendVerificationCode(
    userId: string,
    email: string,
    portalUrl: string,
    audience: 'parent' | 'provider'
  ): Promise<void> {
    // Fetch user data to get name for email template
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
      },
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Delete any existing unverified signup codes for this user.
    // Scoped to type 'signup' so that a pending login_2fa code is not invalidated.
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        verified: false,
        type: 'signup',
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

    // Generate verification URL for the caller's portal
    const verificationUrl = `${portalUrl}/auth/verify-email?code=${code}&email=${encodeURIComponent(email)}`

    // Prepare user name for email template
    const userName = user.firstName
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : 'there'

    // Send email
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Email Verification - World-Camps',
      html: this.emailTemplateService.getVerificationEmailTemplate(
        code,
        this.CODE_EXPIRY_MINUTES,
        userName,
        verificationUrl,
        audience
      ),
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
   * Resend verification code.
   * @param portalUrl - The base URL of the app portal to build the verification link
   * @param audience - Whether the recipient is a parent or a provider; selects the email copy
   */
  async resendVerificationCode(
    email: string,
    portalUrl: string,
    audience: 'parent' | 'provider'
  ): Promise<void> {
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

    // Check for recent code send (cooldown period)
    const mostRecentCode = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (mostRecentCode) {
      const timeSinceLastSend = Date.now() - mostRecentCode.createdAt.getTime()
      const cooldownMs = this.RESEND_COOLDOWN_SECONDS * 1000

      if (timeSinceLastSend < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000)
        throw new BadRequestException(
          `Please wait ${remainingSeconds} seconds before requesting a new code.`
        )
      }
    }

    // Check recent attempts to prevent spam (hourly limit)
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
    await this.createAndSendVerificationCode(user.id, user.email, portalUrl, audience)
  }
}
