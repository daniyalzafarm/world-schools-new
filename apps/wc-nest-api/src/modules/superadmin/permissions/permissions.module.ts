import { Module } from '@nestjs/common'
import { SuperAdminPermissionsController } from './permissions.controller'

@Module({
  controllers: [SuperAdminPermissionsController],
})
export class SuperAdminPermissionsModule {}
