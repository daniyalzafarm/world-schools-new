/**
 * Shared chart colors and theming for Recharts widgets across both dashboards.
 * Pulled from the wc-superadmin tailwind palette (primary teal/green + accents).
 */
export const CHART_COLORS = {
  primary: '#22c192',
  primarySoft: '#45f0b5',
  primaryDark: '#137358',
  blue: '#0091ae',
  blueSoft: '#7dd3fc',
  purple: '#8b5cf6',
  purpleSoft: '#c4b5fd',
  orange: '#f97316',
  orangeSoft: '#fdba74',
  red: '#dc2626',
  redSoft: '#fca5a5',
  yellow: '#eab308',
  yellowSoft: '#fde68a',
  gray: '#94a3b8',
  graySoft: '#cbd5e1',
}

/**
 * Distinct color palette for donut slices, ordered for visual contrast.
 */
export const SLICE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.yellow,
  CHART_COLORS.red,
  CHART_COLORS.primaryDark,
  CHART_COLORS.gray,
  CHART_COLORS.primarySoft,
  CHART_COLORS.blueSoft,
  CHART_COLORS.purpleSoft,
  CHART_COLORS.orangeSoft,
]

export const STATUS_COLOR_MAP: Record<string, string> = {
  // BookingGroup statuses
  draft: CHART_COLORS.gray,
  request: CHART_COLORS.yellow,
  accepted: CHART_COLORS.blue,
  declined: CHART_COLORS.red,
  expired: CHART_COLORS.graySoft,
  deposit_paid: CHART_COLORS.primarySoft,
  fully_paid: CHART_COLORS.primary,
  at_camp: CHART_COLORS.primaryDark,
  completed: CHART_COLORS.primaryDark,
  cancelled: CHART_COLORS.redSoft,
  payment_failed: CHART_COLORS.red,
  partially_refunded: CHART_COLORS.orange,
  fully_refunded: CHART_COLORS.orangeSoft,
  disputed: CHART_COLORS.purple,
  // Payment statuses
  succeeded: CHART_COLORS.primary,
  processing: CHART_COLORS.blue,
  requires_action: CHART_COLORS.yellow,
  requires_capture: CHART_COLORS.purple,
  requires_confirmation: CHART_COLORS.orange,
  requires_payment_method: CHART_COLORS.orangeSoft,
  failed: CHART_COLORS.red,
  canceled: CHART_COLORS.gray,
  // Dispute outcomes
  open: CHART_COLORS.yellow,
  won: CHART_COLORS.primary,
  lost: CHART_COLORS.red,
  warning_closed: CHART_COLORS.orange,
  other: CHART_COLORS.gray,
}

/**
 * Convert a status string (snake_case) to a human-readable label
 * (Title Case With Spaces).
 */
export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
