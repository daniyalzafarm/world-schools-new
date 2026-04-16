import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { randomInt } from 'crypto'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name)
  private readonly CODE_EXPIRY_MINUTES = 15

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
   * Enable Email 2FA for user
   */
  async enableEmailTwoFactor(userId: string): Promise<void> {
    // Check if already enabled
    const existing = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    })

    if (existing?.enabled) {
      throw new BadRequestException('Two-factor authentication is already enabled')
    }

    // Create or update 2FA record
    await this.prisma.twoFactorAuth.upsert({
      where: { userId },
      create: {
        userId,
        method: 'email',
        enabled: true,
        enabledAt: new Date(),
      },
      update: {
        enabled: true,
        enabledAt: new Date(),
      },
    })

    this.logger.log(`Email 2FA enabled for user ${userId}`)
  }

  /**
   * Disable Email 2FA for user
   */
  async disableEmailTwoFactor(userId: string): Promise<void> {
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        enabled: false,
        enabledAt: null,
      },
    })

    // Delete any pending 2FA login verification codes
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        type: 'login_2fa',
        verified: false,
      },
    })

    this.logger.log(`Email 2FA disabled for user ${userId}`)
  }

  /**
   * Get 2FA status for user
   */
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean
    method: string | null
    enabledAt: Date | null
  }> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    })

    return {
      enabled: twoFactor?.enabled ?? false,
      method: twoFactor?.method ?? null,
      enabledAt: twoFactor?.enabledAt ?? null,
    }
  }

  /**
   * Create and send login verification code
   */
  async createAndSendLoginCode(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Delete any existing unverified 2FA login codes
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        type: 'login_2fa',
        verified: false,
      },
    })

    // Generate new code
    const code = this.generateVerificationCode()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES)

    // Save to database with type 'login_2fa'
    await this.prisma.emailVerification.create({
      data: {
        userId,
        code,
        type: 'login_2fa', // Differentiate from signup verification
        expiresAt,
        ipAddress,
        userAgent,
      },
    })

    // Get user name for email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    })

    const userName = user?.firstName
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : 'there'

    // Send email with code
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Login Verification Code - World-Camps',
      html: this.emailTemplateService.getLoginVerificationTemplate(
        code,
        this.CODE_EXPIRY_MINUTES,
        userName
      ),
    })

    if (!emailSent) {
      this.logger.error(`Failed to send login verification email to ${email}`)
      throw new BadRequestException('Failed to send verification code. Please try again.')
    }

    this.logger.log(`Login verification code sent to ${email}`)
  }

  /**
   * Verify login code
   */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId,
        code,
        type: 'login_2fa', // Only check 2FA login codes
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
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verified: true },
    })

    return true
  }
}
