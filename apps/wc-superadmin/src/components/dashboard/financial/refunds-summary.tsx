'use client'

import { ChartCard } from '../shared/chart-card'
import { ProgressRow } from '../shared/progress-row'
import { formatStatusLabel } from '@/lib/chart-theme'
import { pluralize } from '@/lib/format'
import { formatAmount, useCurrencyFormat } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

export function RefundsSummary() {
  const refunds = useFinancialStore(s => s.refunds)
  const loading = useFinancialStore(s => s.loading.refunds)
  const error = useFinancialStore(s => s.errors.refunds)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const isAllCurrencies = !currency

  // In single-currency mode rows are sorted by amount; in All Currencies mode
  // amounts on `byReason` are zero by design, so sort by count.
  const rows = refunds
    ? Object.entries(refunds.byReason).sort((a, b) =>
        isAllCurrencies ? b[1].count - a[1].count : b[1].amount - a[1].amount
      )
    : []

  const colorMap = [
    'bg-primary-500',
    'bg-blue-500',
    'bg-orange-500',
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-default-400',
  ]

  const description = (() => {
    if (!refunds) return 'Refund breakdown by reason'
    if (isAllCurrencies) {
      const distinct = refunds.byCurrency?.length ?? 0
      return `${refunds.totalCount} ${pluralize(refunds.totalCount, 'refund')} across ${distinct} ${pluralize(distinct, 'currency', 'currencies')}`
    }
    return `${refunds.totalCount} ${pluralize(refunds.totalCount, 'refund')} · ${fmtMoney(refunds.totalAmount)} total`
  })()

  return (
    <ChartCard
      title="Refunds Overview"
      description={description}
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('refunds')}
      empty={!loading && rows.length === 0}
    >
      <div className="space-y-3">
        {rows.map(([reason, info], i) => (
          <ProgressRow
            key={reason}
            label={
              <>
                {formatStatusLabel(reason)}
                <span className="ml-1.5 text-xs text-default-400">({info.count})</span>
              </>
            }
            value={isAllCurrencies ? `${info.pct}%` : fmtMoney(info.amount)}
            percent={info.pct}
            colorClass={colorMap[i % colorMap.length]}
          />
        ))}
        {isAllCurrencies && refunds?.byCurrency && refunds.byCurrency.length > 0 && (
          <div className="mt-4 border-t border-default-200 pt-3 dark:border-default-700/50">
            <div className="mb-2 text-xs font-semibold uppercase text-default-500">
              Refund Amounts by Currency
            </div>
            <ul className="space-y-1">
              {refunds.byCurrency.slice(0, 8).map(row => (
                <li
                  key={row.currency}
                  className="flex items-center justify-between text-xs text-default-700 dark:text-default-200"
                >
                  <span className="font-semibold uppercase">{row.currency}</span>
                  <span>
                    <span className="text-default-400">{row.count} ·</span>{' '}
                    {formatAmount(row.amount, row.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ChartCard>
  )
}
