import { Module } from '@nestjs/common'
import { SuperAdminCampsService } from './camps.service'
import { SuperAdminCampsController } from './camps.controller'
import { PrismaModule } from '../../../prisma/prisma.module'
import { OnboardingModule } from '../../provider/onboarding/onboarding.module'

@Module({
  imports: [PrismaModule, OnboardingModule],
  controllers: [SuperAdminCampsController],
  providers: [SuperAdminCampsService],
})
export class SuperAdminCampsModule {}
