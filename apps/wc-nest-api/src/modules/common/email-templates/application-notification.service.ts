import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplateService } from './email-template.service'
import { ConfigService } from '../../../config/config.service'

/**
 * Application Notification Service
 * Handles sending email notifications for provider application status changes
 */
@Injectable()
export class ApplicationNotificationService {
  private readonly logger = new Logger(ApplicationNotificationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Collect all unique email addresses from provider application
   */
  private async collectProviderEmails(providerId: string): Promise<{
    primaryEmail: string
    ccEmails: string[]
  }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        owner: {
          select: { email: true },
        },
      },
    })

    if (!provider) {
      throw new Error('Provider not found')
    }

    const emails = new Set<string>()

    // Add owner email (primary contact - the user who submitted the application)
    if (provider.owner?.email) {
      emails.add(provider.owner.email.toLowerCase())
    }

    // Add contact email from application (if different from owner)
    if (provider.contactEmail) {
      emails.add(provider.contactEmail.toLowerCase())
    }

    // Add provider business email (if different)
    if (provider.email) {
      emails.add(provider.email.toLowerCase())
    }

    const emailArray = Array.from(emails)

    // Primary email is the owner's email (application submitter)
    const primaryEmail = provider.owner?.email?.toLowerCase() || emailArray[0]

    // CC emails are all other unique emails
    const ccEmails = emailArray.filter(email => email !== primaryEmail)

    return { primaryEmail, ccEmails }
  }

  /**
   * Send application submitted confirmation email
   */
  async sendApplicationSubmittedEmail(providerId: string): Promise<void> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          legalCompanyName: true,
          applicationSubmittedAt: true,
        },
      })

      if (!provider) {
        this.logger.error(`Provider not found: ${providerId}`)
        return
      }

      const { primaryEmail, ccEmails } = await this.collectProviderEmails(providerId)

      const submittedDate = provider.applicationSubmittedAt
        ? new Date(provider.applicationSubmittedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

      const html = this.emailTemplateService.getApplicationSubmittedTemplate({
        providerName: provider.legalCompanyName || '',
        applicationId: provider.id,
        submittedDate,
      })

      const emailSent = await this.emailService.sendEmail({
        to: primaryEmail,
        subject: 'Application Received - World-Camps',
        html,
        messageId: `application-submitted-${provider.id}-${Date.now()}`,
      })

      if (emailSent) {
        this.logger.log(
          `Application submitted email sent to ${primaryEmail}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}`
        )

        // Send CC emails separately if there are any
        for (const ccEmail of ccEmails) {
          await this.emailService.sendEmail({
            to: ccEmail,
            subject: 'Application Received - World-Camps',
            html,
            messageId: `application-submitted-cc-${provider.id}-${ccEmail}-${Date.now()}`,
          })
        }
      } else {
        this.logger.error(`Failed to send application submitted email to ${primaryEmail}`)
      }
    } catch (error) {
      this.logger.error(
        `Error sending application submitted email for provider ${providerId}:`,
        error
      )
    }
  }

  /**
   * Send application approved welcome email
   */
  async sendApplicationApprovedEmail(providerId: string): Promise<void> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          legalCompanyName: true,
        },
      })

      if (!provider) {
        this.logger.error(`Provider not found: ${providerId}`)
        return
      }

      const { primaryEmail, ccEmails } = await this.collectProviderEmails(providerId)

      // Get provider login URL from config
      const loginUrl = `${this.configService.providerPortalUrl}/auth/signin`
      const contactEmail = this.configService.emailConfig.from

      const html = this.emailTemplateService.getApplicationApprovedTemplate({
        providerName: provider.legalCompanyName || '',
        loginUrl,
        contactEmail,
      })

      const emailSent = await this.emailService.sendEmail({
        to: primaryEmail,
        subject: 'Welcome to World-Camps! 🎉',
        html,
        messageId: `application-approved-${provider.id}-${Date.now()}`,
      })

      if (emailSent) {
        this.logger.log(
          `Application approved email sent to ${primaryEmail}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}`
        )

        // Send CC emails separately if there are any
        for (const ccEmail of ccEmails) {
          await this.emailService.sendEmail({
            to: ccEmail,
            subject: 'Welcome to World-Camps! 🎉',
            html,
            messageId: `application-approved-cc-${provider.id}-${ccEmail}-${Date.now()}`,
          })
        }
      } else {
        this.logger.error(`Failed to send application approved email to ${primaryEmail}`)
      }
    } catch (error) {
      this.logger.error(
        `Error sending application approved email for provider ${providerId}:`,
        error
      )
    }
  }

  /**
   * Send application rejected notification email
   */
  async sendApplicationRejectedEmail(providerId: string): Promise<void> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: {
          id: true,
          legalCompanyName: true,
          rejectionCategory: true,
          rejectionReason: true,
        },
      })

      if (!provider) {
        this.logger.error(`Provider not found: ${providerId}`)
        return
      }

      const { primaryEmail, ccEmails } = await this.collectProviderEmails(providerId)

      // Get reapply URL from config
      const reapplyUrl = `${this.configService.providerPortalUrl}/signup`

      const html = this.emailTemplateService.getApplicationRejectedTemplate({
        providerName: provider.legalCompanyName || '',
        rejectionCategory: provider.rejectionCategory || undefined,
        rejectionReason: provider.rejectionReason || undefined,
        reapplyUrl,
      })

      const emailSent = await this.emailService.sendEmail({
        to: primaryEmail,
        subject: 'Application Update - World-Camps',
        html,
        messageId: `application-rejected-${provider.id}-${Date.now()}`,
      })

      if (emailSent) {
        this.logger.log(
          `Application rejected email sent to ${primaryEmail}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}`
        )

        // Send CC emails separately if there are any
        for (const ccEmail of ccEmails) {
          await this.emailService.sendEmail({
            to: ccEmail,
            subject: 'Application Update - World-Camps',
            html,
            messageId: `application-rejected-cc-${provider.id}-${ccEmail}-${Date.now()}`,
          })
        }
      } else {
        this.logger.error(`Failed to send application rejected email to ${primaryEmail}`)
      }
    } catch (error) {
      this.logger.error(
        `Error sending application rejected email for provider ${providerId}:`,
        error
      )
    }
  }
}
