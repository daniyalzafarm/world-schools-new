import { Module } from '@nestjs/common'
import { EmailTemplateService } from './email-template.service'
import { ApplicationNotificationService } from './application-notification.service'
import { BookingNotificationService } from './booking-notification.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailService } from '@world-schools/global-utils'

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    EmailTemplateService,
    ApplicationNotificationService,
    BookingNotificationService,
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    EmailTemplateService,
    ApplicationNotificationService,
    BookingNotificationService,
    EmailService,
  ],
})
export class EmailTemplatesModule {}
