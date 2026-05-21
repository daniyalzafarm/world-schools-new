/**
 * Provider-related shared types used across the backend, SuperAdmin, and
 * provider portal.
 */

/**
 * Operational readiness rating computed for an approved provider.
 *
 * Independent of `ApprovalStatus` — a provider can be Approved yet still
 * `setup_incomplete` (Stripe not connected, no published camps, etc.).
 * SuperAdmin needs both signals at a glance to know who to follow up with.
 *
 * Computation lives in
 * `application-review.service.ts → computeOperationalStatus()`.
 */
export enum OperationalStatus {
  /// Approved + Stripe connected + ≥1 published camp + ≥1 published session.
  FullyActive = 'fully_active',
  /// Approved but missing one or more of: Stripe connection, published camp,
  /// published session.
  SetupIncomplete = 'setup_incomplete',
  /// Approved with a regression that needs ops follow-up: Stripe disconnected
  /// after previously being connected, a published camp with no sessions, or
  /// a recent failed payout.
  ActionRequired = 'action_required',
  /// Approved but dormant — no login in 90+ days and no published camps.
  Inactive = 'inactive',
}

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  [OperationalStatus.FullyActive]: 'Fully Active',
  [OperationalStatus.SetupIncomplete]: 'Setup Incomplete',
  [OperationalStatus.ActionRequired]: 'Action Required',
  [OperationalStatus.Inactive]: 'Inactive',
}
