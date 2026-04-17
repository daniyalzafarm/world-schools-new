import { Module } from '@nestjs/common'
import { SuperAdminAuthModule } from './auth/auth.module'
import { SuperAdminRolesModule } from './roles/roles.module'
import { SuperAdminProvidersModule } from './providers/providers.module'
import { SuperAdminUsersModule } from './users/users.module'
import { SuperAdminPermissionsModule } from './permissions/permissions.module'
import { ApplicationReviewModule } from './application-review/application-review.module'
import { SuperAdminCampsModule } from './camps/camps.module'
import { SuperAdminSessionsModule } from './sessions/sessions.module'
import { SuperAdminParentsModule } from './parents/parents.module'

@Module({
  imports: [
    SuperAdminAuthModule,
    SuperAdminRolesModule,
    SuperAdminProvidersModule,
    SuperAdminUsersModule,
    SuperAdminPermissionsModule,
    ApplicationReviewModule,
    SuperAdminCampsModule,
    SuperAdminSessionsModule,
    SuperAdminParentsModule,
  ],
})
export class SuperAdminModule {}
