import { Module } from '@nestjs/common'
import { SuperAdminCampsService } from './camps.service'
import { SuperAdminCampsController } from './camps.controller'
import { SuperAdminCampsAdminController } from './camps-admin.controller'
import { PrismaModule } from '../../../prisma/prisma.module'
import { OnboardingModule } from '../../provider/onboarding/onboarding.module'
import { CampsModule } from '../../provider/camps/camps.module'

@Module({
  imports: [PrismaModule, OnboardingModule, CampsModule],
  controllers: [SuperAdminCampsController, SuperAdminCampsAdminController],
  providers: [SuperAdminCampsService],
})
export class SuperAdminCampsModule {}
