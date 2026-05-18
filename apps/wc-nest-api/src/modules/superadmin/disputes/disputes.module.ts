import { Module } from '@nestjs/common'
import { DisputesModule } from '../../billing/disputes/disputes.module'
import { SuperAdminDisputesController } from './disputes.controller'

@Module({
  imports: [DisputesModule],
  controllers: [SuperAdminDisputesController],
})
export class SuperAdminDisputesModule {}
