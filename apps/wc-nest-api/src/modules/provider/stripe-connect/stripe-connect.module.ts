import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { AuthModule } from '../../core/auth/auth.module'
import { StripeConnectController } from './stripe-connect.controller'
import { StripeConnectService } from './stripe-connect.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StripeConnectController],
  providers: [StripeConnectService],
  exports: [StripeConnectService],
})
export class StripeConnectModule {}
