/**
 * Public surface of the billing/ module.
 *
 * Importers (e.g. `BookingGroupsService`, the Stripe webhook
 * dispatcher) should import from `modules/billing` rather than reaching into
 * the sub-module paths directly. This keeps the billing internals free to
 * reorganize without rippling import changes across the app.
 */

export { BillingModule } from './billing.module'

// Services
export {
  PaymentIntentsService,
  PaymentAuthorizationExpiredError,
} from './intents/payment-intents.service'
export { RefundsService } from './refunds/refunds.service'
export { DisputesService } from './disputes/disputes.service'
export { ReimbursementsService } from './reimbursements/reimbursements.service'

// Domain types/enums (re-exported from the Prisma generated client so callers
// don't reach into `generated/client/enums` themselves)
export { PaymentMode } from './shared/payment-mode'
