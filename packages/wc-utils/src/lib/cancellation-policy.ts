import {
  CANCELLATION_POLICY_LABELS,
  type CancellationPolicy,
  type CancellationPolicyCustomData,
  type CancellationPolicyTier,
  FLEXIBLE_POLICY_TIERS,
  MODERATE_POLICY_TIERS,
} from '@world-schools/wc-types'

export type CancellationPolicyInput = CancellationPolicy | string | null | undefined

function isKnownPolicy(value: CancellationPolicyInput): value is CancellationPolicy {
  return value === 'flexible' || value === 'moderate' || value === 'custom'
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

  const cutoff = new Date(start)
  cutoff.setDate(cutoff.getDate() - fullRefundTier.daysBeforeStart)
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
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
      const tierDate = new Date(start)
      tierDate.setDate(tierDate.getDate() - tier.daysBeforeStart)
      if (isFirst) {
        dateRangeLabel = `Before ${formatDate(tierDate)}`
      } else if (isLast) {
        dateRangeLabel = `After ${formatDate(tierDate)}`
      } else {
        const prevDate = new Date(start)
        prevDate.setDate(prevDate.getDate() - prev.daysBeforeStart)
        dateRangeLabel = `${formatDate(tierDate)} – ${formatDate(prevDate)}`
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
