import { Module } from '@nestjs/common'
import { ProviderPermissionsController } from './permissions.controller'

@Module({
  controllers: [ProviderPermissionsController],
})
export class ProviderPermissionsModule {}
