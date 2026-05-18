// Phase 8: deprecated. Replaced by `update-payout-mode.dto.ts`. Kept as a
// thin re-export so any external import path that still references this
// module resolves cleanly. Remove on the next sweep once all callers are
// audited.
export { UpdatePayoutModeDto as UpdateEarlyPayoutDto } from './update-payout-mode.dto'
