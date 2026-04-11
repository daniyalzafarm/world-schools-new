import { Module } from '@nestjs/common'
import { SuperAdminProvidersService } from './providers.service'
import { SuperAdminProvidersController } from './providers.controller'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { OnboardingModule } from '../../provider/onboarding/onboarding.module'
import { EmailService } from '@world-schools/global-utils'

@Module({
  imports: [PrismaModule, ConfigModule, EmailTemplatesModule, OnboardingModule],
  controllers: [SuperAdminProvidersController],
  providers: [
    SuperAdminProvidersService,
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
})
export class SuperAdminProvidersModule {}
