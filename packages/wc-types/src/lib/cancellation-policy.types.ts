/**
 * Cancellation Policy Types for World Camps Applications
 *
 * These types are shared across wc-provider (frontend), wc-nest-api (backend),
 * and wc-booking (applying policies to refund calculations on bookings).
 */

// ============================================================================
// Core Value Types
// ============================================================================

/**
 * Identifiers for the predefined cancellation policy templates a provider can
 * choose during onboarding (see Provider/Onboarding step 5 design). 'custom'
 * means the provider supplies their own tiers via `cancellationPolicyCustom`.
 */
export const CANCELLATION_POLICY_VALUES = ['flexible', 'moderate', 'custom'] as const
export type CancellationPolicy = (typeof CANCELLATION_POLICY_VALUES)[number]

/** Human-readable labels for each policy identifier (used by UIs and admin views). */
export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, string> = {
  flexible: 'Flexible',
  moderate: 'Moderate',
  custom: 'Custom',
}

/** Allowed refund percentages for standard policy tiers */
export type RefundPercentage = 0 | 25 | 50 | 75 | 100

/** Allowed refund percentages for special circumstance overrides */
export type SpecialCircumstanceRefundPercentage = 50 | 75 | 90 | 100

/** Types of special circumstances that can trigger an exception refund */
export type SpecialCircumstanceType = 'medical' | 'force_majeure' | 'weather'

// ============================================================================
// Policy Tier (Custom Policy Builder)
// ============================================================================

/**
 * A single tier in a cancellation policy.
 *
 * Interpretation: if the cancellation occurs >= daysBeforeStart days before
 * the camp start date, the parent receives refundPercentage% of the balance.
 *
 * Tiers should be stored in descending order of daysBeforeStart so they can
 * be evaluated top-to-bottom (first matching tier wins).
 */
export interface CancellationPolicyTier {
  /** Days before camp start (inclusive lower bound for this tier) */
  daysBeforeStart: number
  /** Percentage of the balance amount to refund */
  refundPercentage: RefundPercentage
}

// ============================================================================
// Special Circumstances
// ============================================================================

/**
 * A special circumstance exception that overrides the standard cancellation
 * policy for specific unexpected events (medical, force majeure, weather).
 *
 * Applies to the balance only — the deposit is always non-refundable.
 */
export interface CancellationPolicySpecialCircumstance {
  type: SpecialCircumstanceType
  /** Percentage of the balance to refund when this circumstance applies */
  refundPercentage: SpecialCircumstanceRefundPercentage
}

// ============================================================================
// Custom Policy Data (stored in cancellationPolicyCustom JSON column)
// ============================================================================

/**
 * Structured JSON stored in the `cancellation_policy_custom` database column
 * when a provider selects the "custom" policy type.
 *
 * Always contains exactly 4 tiers with daysBeforeStart values of 90, 60, 30, 0
 * (in descending order).
 */
export interface CancellationPolicyCustomData {
  tiers: CancellationPolicyTier[]
}

// ============================================================================
// Predefined Policy Tiers (canonical constants for booking refund calculations)
// ============================================================================

/**
 * Flexible policy: full refund until 30 days before, no refund after.
 * Earns 5 trust score points.
 */
export const FLEXIBLE_POLICY_TIERS: readonly CancellationPolicyTier[] = [
  { daysBeforeStart: 30, refundPercentage: 100 },
  { daysBeforeStart: 0, refundPercentage: 0 },
] as const

/**
 * Moderate policy: full refund until 60 days, 50% until 30 days, no refund after.
 * Earns 3 trust score points.
 */
export const MODERATE_POLICY_TIERS: readonly CancellationPolicyTier[] = [
  { daysBeforeStart: 60, refundPercentage: 100 },
  { daysBeforeStart: 30, refundPercentage: 50 },
  { daysBeforeStart: 0, refundPercentage: 0 },
] as const

/**
 * Default custom policy tiers shown in the custom policy builder UI.
 * Providers can adjust the refund percentages for each tier.
 */
export const DEFAULT_CUSTOM_POLICY_TIERS: readonly CancellationPolicyTier[] = [
  { daysBeforeStart: 90, refundPercentage: 100 },
  { daysBeforeStart: 60, refundPercentage: 100 },
  { daysBeforeStart: 30, refundPercentage: 50 },
  { daysBeforeStart: 0, refundPercentage: 0 },
] as const
