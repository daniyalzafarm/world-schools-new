import {
  CANCELLATION_POLICY_LABELS,
  type CancellationPolicy,
  type CancellationPolicyCustomData,
  type CancellationPolicyTier,
  FLEXIBLE_POLICY_TIERS,
  MODERATE_POLICY_TIERS,
  STRICT_POLICY_TIERS,
} from '@world-schools/wc-types'

export type CancellationPolicyInput = CancellationPolicy | string | null | undefined

function isKnownPolicy(value: CancellationPolicyInput): value is CancellationPolicy {
  return value === 'flexible' || value === 'moderate' || value === 'strict' || value === 'custom'
}

/**
 * Resolve the tier list for a given policy. Unknown / missing policies fall
 * back to MODERATE (the legacy default for providers without a saved policy).
 */
export function resolveTiers(
  policy: CancellationPolicyInput,
  customTiers: CancellationPolicyCustomData | null | undefined
): readonly CancellationPolicyTier[] {
  if (policy === 'flexible') return FLEXIBLE_POLICY_TIERS
  if (policy === 'strict') return STRICT_POLICY_TIERS
  if (policy === 'custom' && customTiers?.tiers?.length) return customTiers.tiers
  return MODERATE_POLICY_TIERS
}

/**
 * Date the customer must cancel before to receive a 100% refund. Returns null
 * if the session start is missing/invalid or no tier offers a 100% refund.
 */
export function getFreeCancellationCutoffDate(
  sessionStartDate: string | Date | null | undefined,
  policy: CancellationPolicyInput,
  customTiers: CancellationPolicyCustomData | null | undefined
): Date | null {
  if (!sessionStartDate) return null
  const start = sessionStartDate instanceof Date ? sessionStartDate : new Date(sessionStartDate)
  if (Number.isNaN(start.getTime())) return null

  const tiers = resolveTiers(policy, customTiers)
  const fullRefundTier = tiers
    .filter(t => t.refundPercentage === 100)
    .reduce<CancellationPolicyTier | null>(
      (best, t) => (best === null || t.daysBeforeStart > best.daysBeforeStart ? t : best),
      null
    )
  if (!fullRefundTier) return null

  // UTC-safe arithmetic: ISO date-only inputs ("2026-06-22") parse as UTC
  // midnight; using local-time setDate/getDate would shift the resulting
  // date by a day for users west of UTC. setUTCDate keeps the calendar
  // date stable regardless of the viewer's timezone.
  const cutoff = new Date(start)
  cutoff.setUTCDate(cutoff.getUTCDate() - fullRefundTier.daysBeforeStart)
  return cutoff
}

/**
 * Apply the policy on an actual cancellation event: given how many whole days
 * remain until the camp starts, return the refund percentage owed (the highest
 * matching tier).
 */
export function getRefundPercentage(
  daysBeforeStart: number,
  policy: CancellationPolicyInput,
  customTiers: CancellationPolicyCustomData | null | undefined
): number {
  const tiers = [...resolveTiers(policy, customTiers)].sort(
    (a, b) => b.daysBeforeStart - a.daysBeforeStart
  )
  const matched = tiers.find(t => daysBeforeStart >= t.daysBeforeStart)
  return matched?.refundPercentage ?? 0
}

/** Pure math: refund amount rounded to whole currency units. */
export function getRefundAmount(total: number, percentage: number): number {
  return Math.round((total * percentage) / 100)
}

/** Display label for a refund percentage (Full refund / X% refund / No refund). */
export function getRefundLabel(percentage: number): string {
  if (percentage === 100) return 'Full refund'
  if (percentage === 0) return 'No refund'
  return `${percentage}% refund`
}

/** Display label for a policy identifier (Flexible / Moderate / Custom). */
export function getCancellationPolicyLabel(policy: CancellationPolicyInput): string {
  if (isKnownPolicy(policy)) return CANCELLATION_POLICY_LABELS[policy]
  return 'Custom'
}

/**
 * One row in a tier-schedule display (camp-detail section, modal, FAQ).
 *
 * The shape is intentionally generic — the calling component decides how to
 * render it. `rangeLabel` describes the cancellation window in plain text
 * (e.g. "30+ days before camp", "Less than 60 days before camp"), and
 * `dateRangeLabel` is populated with absolute dates when a session start is
 * provided (e.g. "Before Aug 12, 2026").
 */
export interface CancellationPolicyDisplayRow {
  daysBeforeStart: number
  refundPercentage: number
  refundLabel: string
  rangeLabel: string
  dateRangeLabel: string | null
}

function formatDate(date: Date) {
  // Format in UTC so the displayed calendar date matches the date arithmetic
  // (which is UTC-based). Without this, a user in a non-UTC zone would see
  // the date shifted by one when the input is a date-only ISO string.
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Build a UI-agnostic schedule of policy rows, sorted from "most days before"
 * (best refund) down to the day-of-camp tier. Used by:
 *  - the booking flow's CancellationPolicyModal
 *  - the camp detail page's CancellationPolicySection
 *  - the FAQ builder
 */
export function buildCancellationPolicyRows(
  policy: CancellationPolicyInput,
  customTiers: CancellationPolicyCustomData | null | undefined,
  sessionStartDate?: string | Date | null
): CancellationPolicyDisplayRow[] {
  const sorted = [...resolveTiers(policy, customTiers)].sort(
    (a, b) => b.daysBeforeStart - a.daysBeforeStart
  )
  const start = sessionStartDate ? new Date(sessionStartDate) : null
  const hasValidStart = start && !Number.isNaN(start.getTime())

  return sorted.map((tier, index) => {
    const prev = sorted[index - 1]
    const isFirst = index === 0
    const isLast = tier.daysBeforeStart === 0

    let rangeLabel: string
    let dateRangeLabel: string | null = null

    if (isFirst) {
      rangeLabel = `${tier.daysBeforeStart}+ days before camp`
    } else if (isLast) {
      rangeLabel = `Less than ${prev.daysBeforeStart} days before camp`
    } else {
      rangeLabel = `${tier.daysBeforeStart}–${prev.daysBeforeStart} days before camp`
    }

    if (hasValidStart) {
      // Date arithmetic in UTC so the calendar date is stable for users
      // worldwide. Wording uses inclusive lower-bound semantics (matches
      // the tier match rule `daysBeforeStart >= tier.daysBeforeStart`):
      //   - Row 1 ("Before X"): cancellation on or before X-1 inclusive
      //   - Middle rows ("X – Y"): X is one day after the previous boundary
      //     (so the boundary date X belongs only to the previous, higher-%
      //     tier — no overlap), Y is the upper bound inclusive
      //   - Last row ("After X"): cancellation on X+1 onwards
      // Concretely, with Jun 22 start + 60/30/0 moderate tiers, output:
      //   - "Before Apr 24, 2026" (cancel on or before Apr 23 → 100%)
      //   - "Apr 24, 2026 – May 23, 2026" (50%)
      //   - "After May 23, 2026" (0%)
      // No date appears in two rows; readers can't accidentally place the
      // boundary date in the wrong tier.
      const tierDate = new Date(start)
      tierDate.setUTCDate(tierDate.getUTCDate() - tier.daysBeforeStart)
      if (isFirst) {
        // The user must cancel BEFORE the day after the tier boundary to
        // qualify for this tier. Equivalent to "By Apr 23" but reads more
        // naturally in the modal alongside the "After …" final row.
        const cutoff = new Date(tierDate)
        cutoff.setUTCDate(cutoff.getUTCDate() + 1)
        dateRangeLabel = `Before ${formatDate(cutoff)}`
      } else if (isLast) {
        // "Less than N days before camp" = (S - N, S]. Surface the start
        // of that window: cancellations strictly after S - N fall here.
        const prevDate = new Date(start)
        prevDate.setUTCDate(prevDate.getUTCDate() - prev.daysBeforeStart)
        dateRangeLabel = `After ${formatDate(prevDate)}`
      } else {
        // Middle rows: lower bound is prev-tier boundary + 1 (so X is not
        // shared with the higher-tier row above), upper bound is the
        // current tier boundary inclusive.
        const prevDate = new Date(start)
        prevDate.setUTCDate(prevDate.getUTCDate() - prev.daysBeforeStart + 1)
        dateRangeLabel = `${formatDate(prevDate)} – ${formatDate(tierDate)}`
      }
    }

    return {
      daysBeforeStart: tier.daysBeforeStart,
      refundPercentage: tier.refundPercentage,
      refundLabel: getRefundLabel(tier.refundPercentage),
      rangeLabel,
      dateRangeLabel,
    }
  })
}
