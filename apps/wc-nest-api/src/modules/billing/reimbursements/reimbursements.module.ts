import { Module } from '@nestjs/common'
import { ConfigModule } from '../../../config/config.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { RedisModule } from '../../redis/redis.module'
import { ReimbursementFollowupCron } from './crons/reimbursement-followup.cron'
import { ReimbursementsNotificationsService } from './notifications/reimbursements-notifications.service'
import { ReimbursementsService } from './reimbursements.service'

@Module({
  imports: [PrismaModule, ConfigModule, EmailTemplatesModule, RedisModule],
  providers: [ReimbursementsService, ReimbursementsNotificationsService, ReimbursementFollowupCron],
  exports: [ReimbursementsService],
})
export class ReimbursementsModule {}
