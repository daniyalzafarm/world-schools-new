/**
 * Re-export of the Prisma `PaymentMode` enum so consumers (BookingGroupsService,
 * tests, controllers) have a single import path under `billing/` instead of
 * reaching into the Prisma generated client. This avoids leaking the
 * `generated/client/enums` path across module boundaries.
 *
 * Future shared payment types should live alongside this file (e.g.
 * `payments.types.ts`) and eventually move to `packages/wc-types/src/lib/`
 * when the cross-package type story for billing is consolidated.
 */
export { PaymentMode } from '../../../generated/client/enums'
