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
import { AdminSettingsModule } from './admin-settings/admin-settings.module'
import { SuperAdminBillingModule } from './billing/billing.module'
import { SuperAdminDisputesModule } from './disputes/disputes.module'

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
    AdminSettingsModule,
    SuperAdminBillingModule,
    SuperAdminDisputesModule,
  ],
})
export class SuperAdminModule {}
