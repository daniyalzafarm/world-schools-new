import { Module } from '@nestjs/common'
import { ConfigModule } from '../../../config/config.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { CapturesModule } from '../captures/captures.module'
import { PayoutsModule } from '../payouts/payouts.module'
import { ReimbursementsModule } from '../reimbursements/reimbursements.module'
import { RefundsNotificationsService } from './notifications/refunds-notifications.service'
import { RefundsService } from './refunds.service'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    EmailTemplatesModule,
    ReimbursementsModule,
    PayoutsModule,
    CapturesModule,
  ],
  providers: [RefundsService, RefundsNotificationsService],
  exports: [RefundsService, RefundsNotificationsService],
})
export class RefundsModule {}
