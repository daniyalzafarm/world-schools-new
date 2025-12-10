import { Module } from '@nestjs/common'
import { ProviderAuthModule } from './auth/auth.module'
import { ProviderRolesModule } from './roles/roles.module'
import { ProviderUsersModule } from './users/users.module'
import { ProviderPermissionsModule } from './permissions/permissions.module'

@Module({
  imports: [
    ProviderAuthModule,
    ProviderRolesModule,
    ProviderUsersModule,
    ProviderPermissionsModule,
  ],
})
export class ProviderModule {}
