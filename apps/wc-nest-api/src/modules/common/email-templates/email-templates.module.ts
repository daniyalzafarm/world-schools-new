import { Module } from '@nestjs/common'
import { EmailTemplateService } from './email-template.service'
import { ApplicationNotificationService } from './application-notification.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailService } from '@world-schools/global-utils'

/**
 * Legacy email-template module. Pre-v28 host of all transactional email
 * services. Phase 5 cutover removed `BookingNotificationService` (booking
 * accepted/declined emails now live in the catalog as
 * `parent.booking.accepted` + `parent.booking.declined`).
 *
 * Still here pending later phase migration:
 *  - `EmailTemplateService` — verification, 2FA, provider-import templates
 *    that aren't notifications (auth-flow only, stay per the plan).
 *  - `ApplicationNotificationService` — provider application
 *    received/approved/declined emails (migrate to catalog in Phase 8 with
 *    the rest of the provider onboarding triggers).
 *
 * Also still owns the singleton `EmailService` factory — Phase 4's
 * NotificationsModule imports this module solely for that. Will be
 * extracted to a tiny standalone `EmailModule` once the legacy services
 * are gone.
 */
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    EmailTemplateService,
    ApplicationNotificationService,
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailTemplateService, ApplicationNotificationService, EmailService],
})
export class EmailTemplatesModule {}
