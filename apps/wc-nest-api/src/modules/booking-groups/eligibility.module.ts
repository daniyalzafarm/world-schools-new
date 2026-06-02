import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { EligibilityService } from './eligibility.service'

/**
 * Lightweight module exposing the shared eligibility evaluator. Depends only on
 * the (global) PrismaService so it can be imported by booking-groups, user
 * camps, and provider booking-groups without dragging in billing/websocket.
 */
@Module({
  imports: [PrismaModule],
  providers: [EligibilityService],
  exports: [EligibilityService],
})
export class EligibilityModule {}
