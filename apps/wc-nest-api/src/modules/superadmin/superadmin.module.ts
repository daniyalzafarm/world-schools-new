import { Module } from '@nestjs/common'
import { SuperAdminAuthModule } from './auth/auth.module'
import { SuperAdminRolesModule } from './roles/roles.module'
import { SuperAdminProvidersModule } from './providers/providers.module'
import { SuperAdminUsersModule } from './users/users.module'
import { SuperAdminPermissionsModule } from './permissions/permissions.module'
import { ApplicationReviewModule } from './application-review/application-review.module'

@Module({
  imports: [
    SuperAdminAuthModule,
    SuperAdminRolesModule,
    SuperAdminProvidersModule,
    SuperAdminUsersModule,
    SuperAdminPermissionsModule,
    ApplicationReviewModule,
  ],
})
export class SuperAdminModule {}
