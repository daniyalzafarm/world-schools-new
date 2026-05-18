/**
 * Payment-plan policy is shared with the backend via `@world-schools/wc-utils`.
 *
 * This file is a thin shim: existing call sites import from
 * `@/utils/payment-plan`, and we re-export here so they continue to work
 * without touching every component. New code should import from
 * `@world-schools/wc-utils` directly.
 *
 * The backend re-computes authoritatively at submit time — frontend output
 * here is only for UI rendering. If the two ever diverge, the server's
 * snapshot wins (UI just shows an outdated number until the page reloads).
 */

export {
  BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW,
  BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW,
  computePaymentPlan,
  computeDepositAmountNumber as computeDepositAmount,
} from '@world-schools/wc-utils'

export type { DepositSettingsForPlan, PaymentPlan, PaymentPlanKind } from '@world-schools/wc-utils'
