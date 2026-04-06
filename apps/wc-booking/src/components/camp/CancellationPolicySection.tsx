import type { ReactNode } from 'react'
import type { Session } from '../../types/sessions'

type CancellationPolicyType = 'flexible' | 'moderate' | 'standard' | 'strict' | 'custom'

interface PolicyRule {
  label: string
  refundPct: 100 | 50 | 0
  minDays: number // days until start >= this → user is in this tier
}

interface PolicyTemplate {
  displayName: string
  description: string
  tier: 'flexible' | 'standard' | 'strict' | 'custom'
  rules: PolicyRule[] // sorted by minDays descending
}

// Rules sorted high → low so findIndex returns the first match
const POLICY_TEMPLATES: Record<string, PolicyTemplate> = {
  flexible: {
    displayName: 'Flexible',
    description: 'Full refund if cancelled 14+ days before start. 50% refund within 14 days.',
    tier: 'flexible',
    rules: [
      { label: '14+ days before start', refundPct: 100, minDays: 14 },
      { label: '0–13 days before start', refundPct: 50, minDays: 0 },
    ],
  },
  // "moderate" is the legacy backend key for the Standard tier
  moderate: {
    displayName: 'Standard',
    description:
      'Full refund if cancelled 30+ days before start. 50% refund 15–29 days. No refund within 14 days.',
    tier: 'standard',
    rules: [
      { label: '30+ days before start', refundPct: 100, minDays: 30 },
      { label: '15–29 days before start', refundPct: 50, minDays: 15 },
      { label: '0–14 days before start', refundPct: 0, minDays: 0 },
    ],
  },
  standard: {
    displayName: 'Standard',
    description:
      'Full refund if cancelled 30+ days before start. 50% refund 15–29 days. No refund within 14 days.',
    tier: 'standard',
    rules: [
      { label: '30+ days before start', refundPct: 100, minDays: 30 },
      { label: '15–29 days before start', refundPct: 50, minDays: 15 },
      { label: '0–14 days before start', refundPct: 0, minDays: 0 },
    ],
  },
  strict: {
    displayName: 'Strict',
    description: 'Full refund if cancelled 60+ days before start. No refund within 60 days.',
    tier: 'strict',
    rules: [
      { label: '60+ days before start', refundPct: 100, minDays: 60 },
      { label: '0–59 days before start', refundPct: 0, minDays: 0 },
    ],
  },
}

const BADGE_CLASSES: Record<string, string> = {
  flexible: 'bg-[#dcfce7] text-[#15803d]',
  standard: 'bg-[#fef3c7] text-[#b45309]',
  strict: 'bg-[#fee2e2] text-[#b91c1c]',
  custom: 'bg-gray-100 text-gray-600',
}

interface CancellationPolicySectionProps {
  policy: CancellationPolicyType
  customPolicy?: any
  depositRequired?: boolean
  depositType?: string | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null
  currency?: string
  selectedSession?: Session | null
}

export function CancellationPolicySection({
  policy,
  customPolicy,
  depositRequired,
  depositType,
  depositPercentage,
  depositFixedAmount,
  currency = 'EUR',
  selectedSession,
}: CancellationPolicySectionProps) {
  const template = POLICY_TEMPLATES[policy]
  const isCustom = policy === 'custom'

  // For custom policies, try to derive a minimal display from free-form data
  const customDescription: string | null = customPolicy?.description ?? customPolicy?.text ?? null

  if (!template && !(isCustom && customDescription)) return null

  // ── Days until session start ──────────────────────────────────────────────
  const daysUntilStart =
    selectedSession != null
      ? Math.ceil(
          (new Date(selectedSession.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : null

  const rules: PolicyRule[] = template?.rules ?? []
  const hasZeroTier = rules.some(r => r.refundPct === 0)

  // Index of the rule the user currently falls into (highest minDays ≤ daysUntilStart)
  const activeRuleIndex =
    daysUntilStart !== null ? rules.findIndex(r => daysUntilStart >= r.minDays) : -1
  const activeRule = activeRuleIndex >= 0 ? rules[activeRuleIndex] : null

  // ── Deposit note ─────────────────────────────────────────────────────────
  let depositNote: string | null = null
  if (depositRequired) {
    if (depositType === 'percentage' && depositPercentage != null) {
      depositNote = `A ${depositPercentage}% deposit is required at booking and is non-refundable.`
    } else if (depositType === 'fixed' && depositFixedAmount != null) {
      const formatted = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(depositFixedAmount)
      depositNote = `A ${formatted} deposit is required at booking and is non-refundable.`
    } else {
      depositNote = 'A deposit is required at booking and is non-refundable.'
    }
  }

  const displayName = template?.displayName ?? 'Custom'
  const tier = template?.tier ?? 'custom'
  const description = template?.description ?? customDescription
  const badgeClass = BADGE_CLASSES[tier] ?? BADGE_CLASSES.custom

  // ── Date-adaptive banner ─────────────────────────────────────────────────
  const sessionStartStr = selectedSession
    ? new Date(selectedSession.startDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
    : null

  let banner: { cls: string; icon: string; text: ReactNode } | null = null
  if (activeRule && sessionStartStr) {
    if (activeRule.refundPct === 100) {
      banner = {
        cls: 'bg-primary/10 text-[#065f46] border border-primary/30',
        icon: '✓',
        text: (
          <>
            Your camp starts <strong>{sessionStartStr}</strong> — you&apos;re within the{' '}
            <strong>full refund</strong> window if you need to cancel.
          </>
        ),
      }
    } else if (activeRule.refundPct === 50) {
      banner = {
        cls: 'bg-[#fef3c7] text-[#92400e] border border-amber-300',
        icon: '⚠️',
        text: (
          <>
            Your camp starts <strong>{sessionStartStr}</strong> — you&apos;re within the{' '}
            <strong>partial refund window</strong>. Cancelling now would give you 50% back.
          </>
        ),
      }
    } else {
      banner = {
        cls: 'bg-[#fee2e2] text-[#991b1b] border border-red-300',
        icon: '⚠️',
        text: (
          <>
            Your camp starts <strong>{sessionStartStr}</strong> — you are past the refund window.{' '}
            <strong>Cancellation is non-refundable</strong> at this stage.
          </>
        ),
      }
    }
  }

  return (
    <section id="cancellation" className="mb-10 md:mb-12 scroll-mt-14 md:scroll-mt-16">
      {/* ── Section header: title + policy badge ─── */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-[clamp(18px,3vw,24px)] font-bold text-gray-900">Cancellation policy</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-semibold ${badgeClass}`}
        >
          {tier === 'flexible' ? `✓ ${displayName}` : displayName}
        </span>
      </div>

      {/* ── Summary description ──────────────────── */}
      {description && <p className="text-base text-gray-700 leading-[1.65] mb-4">{description}</p>}

      {/* ── Deposit banner ───────────────────────── */}
      {depositNote && (
        <div className="flex items-start gap-2.5 py-3 px-4 rounded-[10px] text-[14px] mb-5 leading-[1.5] bg-[#fef3c7] text-[#92400e] border border-amber-300">
          <span className="text-base shrink-0 mt-px">⚠️</span>
          <span>{depositNote}</span>
        </div>
      )}

      {/* ── Refund schedule table ────────────────── */}
      {rules.length > 0 && (
        <table className="w-full border-collapse mt-5 text-[14px]">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500 pb-[10px] px-4">
                Cancellation timing
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500 pb-[10px] px-4" />
              <th className="text-right text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500 pb-[10px] px-4">
                Refund
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, i) => {
              const isActive = i === activeRuleIndex

              // ✓ check icon: no-session → show for full-refund rows (or all non-zero if no 0% tier)
              //              session → show only on the active row
              const showCheck =
                activeRuleIndex < 0
                  ? rule.refundPct > 0 && (!hasZeroTier || rule.refundPct === 100)
                  : isActive

              // Row highlight class
              let rowCls = ''
              let firstCellBorderCls = ''
              let youAreHereColorCls = ''

              if (isActive) {
                if (rule.refundPct === 100) {
                  rowCls = 'bg-primary/10 font-semibold text-gray-900'
                  firstCellBorderCls = 'border-l-[3px] border-primary'
                  youAreHereColorCls = 'text-[#059669]'
                } else if (rule.refundPct === 50) {
                  rowCls = 'bg-[#fef3c7] font-semibold text-[#92400e]'
                  firstCellBorderCls = 'border-l-[3px] border-amber-500'
                } else {
                  rowCls = 'bg-[#fee2e2] font-semibold text-[#b91c1c]'
                  firstCellBorderCls = 'border-l-[3px] border-red-500'
                }
              }

              // Refund percentage pill
              const pillCls =
                rule.refundPct === 100
                  ? 'bg-[#dcfce7] text-[#15803d]'
                  : rule.refundPct > 0
                    ? 'bg-[#fef3c7] text-[#b45309]'
                    : 'bg-[#fee2e2] text-[#b91c1c]'

              return (
                <tr key={i} className={rowCls}>
                  <td
                    className={`py-3 px-4 border-t border-gray-100 align-middle ${firstCellBorderCls}`}
                  >
                    {showCheck && <span className="text-[#16a34a] mr-1.5">✓</span>}
                    {rule.label}
                  </td>
                  <td className="py-3 px-4 border-t border-gray-100 align-middle text-[12px] whitespace-nowrap">
                    {isActive && daysUntilStart !== null && (
                      <span className={youAreHereColorCls}>
                        ← You are here ({daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''} away)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-t border-gray-100 align-middle text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-bold ${pillCls}`}
                    >
                      {rule.refundPct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ── Date-adaptive banner ─────────────────── */}
      {banner && (
        <div
          className={`flex items-start gap-2.5 py-3 px-4 rounded-[10px] text-[14px] mt-4 leading-[1.5] ${banner.cls}`}
        >
          <span className="text-base shrink-0 mt-px">{banner.icon}</span>
          <span>{banner.text}</span>
        </div>
      )}
    </section>
  )
}
