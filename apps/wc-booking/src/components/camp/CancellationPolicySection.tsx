import type { ReactNode } from 'react'
import type { CancellationPolicyCustomData } from '@world-schools/wc-types'
import { buildCancellationPolicyRows, getCancellationPolicyLabel } from '@world-schools/wc-utils'
import type { Session } from '../../types/sessions'

const BADGE_CLASSES: Record<string, string> = {
  flexible: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  custom: 'bg-gray-100 text-gray-600',
}

const POLICY_DESCRIPTIONS: Record<string, string> = {
  flexible: '100% refund until 30 days before start, 0% after.',
  moderate: '100% refund until 60 days before, 50% until 30 days, 0% after.',
}

interface CancellationPolicySectionProps {
  policy: string
  customPolicy?: CancellationPolicyCustomData | null
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
  const rows = buildCancellationPolicyRows(policy, customPolicy, selectedSession?.startDate)
  if (rows.length === 0) return null

  const daysUntilStart =
    selectedSession != null
      ? Math.ceil(
          (new Date(selectedSession.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : null

  const activeRowIndex =
    daysUntilStart !== null ? rows.findIndex(r => daysUntilStart >= r.daysBeforeStart) : -1
  const activeRow = activeRowIndex >= 0 ? rows[activeRowIndex] : null
  const hasZeroTier = rows.some(r => r.refundPercentage === 0)

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

  const displayName = getCancellationPolicyLabel(policy)
  const badgeKey = policy in BADGE_CLASSES ? policy : 'custom'
  const badgeClass = BADGE_CLASSES[badgeKey]
  const description = POLICY_DESCRIPTIONS[policy] ?? null

  const sessionStartStr = selectedSession
    ? new Date(selectedSession.startDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
    : null

  let banner: { cls: string; icon: string; text: ReactNode } | null = null
  if (activeRow && sessionStartStr) {
    if (activeRow.refundPercentage === 100) {
      banner = {
        cls: 'bg-primary/10 text-emerald-800 border border-primary/30',
        icon: '✓',
        text: (
          <>
            Your camp starts <strong>{sessionStartStr}</strong> — you&apos;re within the{' '}
            <strong>full refund</strong> window if you need to cancel.
          </>
        ),
      }
    } else if (activeRow.refundPercentage > 0) {
      banner = {
        cls: 'bg-amber-100 text-amber-800 border border-amber-300',
        icon: '⚠️',
        text: (
          <>
            Your camp starts <strong>{sessionStartStr}</strong> — you&apos;re within the{' '}
            <strong>partial refund window</strong>. Cancelling now would give you{' '}
            {activeRow.refundPercentage}% back.
          </>
        ),
      }
    } else {
      banner = {
        cls: 'bg-red-100 text-red-800 border border-red-300',
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
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-[clamp(18px,3vw,24px)] font-bold text-gray-900">Cancellation policy</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${badgeClass}`}
        >
          {policy === 'flexible' ? `✓ ${displayName}` : displayName}
        </span>
      </div>

      {description && <p className="text-gray-900 leading-relaxed mb-4">{description}</p>}

      {depositNote && (
        <div className="flex items-start gap-2.5 py-3 px-4 rounded-xl text-sm mb-5 leading-normal bg-amber-100 text-amber-800 border border-amber-300">
          <span className="text-base shrink-0 mt-px">⚠️</span>
          <span>{depositNote}</span>
        </div>
      )}

      <table className="w-full border-collapse mt-5 text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-500 pb-2.5 px-4">
              Cancellation timing
            </th>
            <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-500 pb-2.5 px-4" />
            <th className="text-right text-xs font-bold uppercase tracking-wider text-gray-500 pb-2.5 px-4">
              Refund
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isActive = i === activeRowIndex

            const showCheck =
              activeRowIndex < 0
                ? row.refundPercentage > 0 && (!hasZeroTier || row.refundPercentage === 100)
                : isActive

            let rowCls = ''
            let firstCellBorderCls = ''
            let youAreHereColorCls = ''

            if (isActive) {
              if (row.refundPercentage === 100) {
                rowCls = 'bg-primary/10 font-semibold text-gray-900'
                firstCellBorderCls = 'border-l-[3px] border-primary'
                youAreHereColorCls = 'text-emerald-600'
              } else if (row.refundPercentage > 0) {
                rowCls = 'bg-amber-100 font-semibold text-amber-800'
                firstCellBorderCls = 'border-l-[3px] border-amber-500'
              } else {
                rowCls = 'bg-red-100 font-semibold text-red-700'
                firstCellBorderCls = 'border-l-[3px] border-red-500'
              }
            }

            const pillCls =
              row.refundPercentage === 100
                ? 'bg-green-100 text-green-700'
                : row.refundPercentage > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'

            return (
              <tr key={`${row.daysBeforeStart}-${row.refundPercentage}`} className={rowCls}>
                <td
                  className={`py-3 px-4 border-t border-gray-100 align-middle ${firstCellBorderCls}`}
                >
                  {showCheck && <span className="text-green-600 mr-1.5">✓</span>}
                  {row.rangeLabel}
                </td>
                <td className="py-3 px-4 border-t border-gray-100 align-middle text-xs whitespace-nowrap">
                  {isActive && daysUntilStart !== null && (
                    <span className={youAreHereColorCls}>
                      ← You are here ({daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''} away)
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 border-t border-gray-100 align-middle text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${pillCls}`}
                  >
                    {row.refundPercentage}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {banner && (
        <div
          className={`flex items-start gap-2.5 py-3 px-4 rounded-xl text-sm mt-4 leading-normal ${banner.cls}`}
        >
          <span className="text-base shrink-0 mt-px">{banner.icon}</span>
          <span>{banner.text}</span>
        </div>
      )}
    </section>
  )
}
