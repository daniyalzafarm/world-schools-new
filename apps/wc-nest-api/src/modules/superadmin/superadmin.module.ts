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
import { SuperAdminAnalyticsModule } from './analytics/analytics.module'
import { SuperAdminFinancialModule } from './financial/financial.module'
import { ProviderReviewModule } from './provider-review/provider-review.module'
import { PaymentReviewModule } from './payment-review/payment-review.module'
import { ForceMajeureModule } from './force-majeure/force-majeure.module'

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
    SuperAdminAnalyticsModule,
    SuperAdminFinancialModule,
    ProviderReviewModule,
    PaymentReviewModule,
    ForceMajeureModule,
  ],
})
export class SuperAdminModule {}
