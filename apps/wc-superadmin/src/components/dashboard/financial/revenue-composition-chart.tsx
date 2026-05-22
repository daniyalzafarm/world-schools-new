'use client'

import { useMemo, useState } from 'react'
import { ChartCard } from '../shared/chart-card'
import { StackedBarChart } from '../charts/stacked-bar-chart'
import { CHART_COLORS } from '@/lib/chart-theme'
import { formatAmount, useCurrencyFormat } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

export function RevenueCompositionChart() {
  const composition = useFinancialStore(s => s.revenueComposition)
  const loading = useFinancialStore(s => s.loading.revenueComposition)
  const error = useFinancialStore(s => s.errors.revenueComposition)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  // All Currencies mode: render a different chart per top currency in a small
  // horizontal scroller. Each sub-chart keeps the same stacked-fees/refunds/
  // reimbursements series but is scoped to one currency so the y-axis is
  // honestly denominated.
  const isAllCurrencies = !currency && !!composition?.byCurrency

  // Rank currencies in All Currencies mode by total volume (sum of fees +
  // refunds + reimbursements across all buckets) so the chart highlights the
  // currencies that actually matter.
  const rankedCurrencies = useMemo(() => {
    if (!isAllCurrencies || !composition?.byCurrency) return []
    return Object.entries(composition.byCurrency)
      .map(([c, info]) => {
        const total = info.buckets.reduce(
          (s, b) => s + b.applicationFees + b.refunds + b.reimbursements,
          0
        )
        return { currency: c, total }
      })
      .sort((a, b) => b.total - a.total)
      .map(r => r.currency)
  }, [composition, isAllCurrencies])

  const [activeCurrency, setActiveCurrency] = useState<string | null>(null)
  const shownCurrency = activeCurrency ?? rankedCurrencies[0] ?? null

  if (isAllCurrencies) {
    const buckets =
      shownCurrency && composition?.byCurrency?.[shownCurrency]?.buckets
        ? composition.byCurrency[shownCurrency].buckets
        : []
    const data = buckets.map(b => ({
      date: b.date,
      applicationFees: b.applicationFees,
      refunds: b.refunds,
      reimbursements: b.reimbursements,
    }))
    return (
      <ChartCard
        title="Revenue Composition"
        description={`Application fees vs refunds vs reimbursements (by ${composition?.bucket ?? 'period'}) — viewing ${shownCurrency?.toUpperCase() ?? '—'}`}
        loading={loading}
        error={error}
        onRetry={() => void fetchWidget('revenueComposition')}
        empty={!loading && rankedCurrencies.length === 0}
        actions={
          rankedCurrencies.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {rankedCurrencies.slice(0, 6).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCurrency(c)}
                  className={`cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                    c === shownCurrency
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-200'
                      : 'border-default-200 text-default-600 hover:bg-default-100 dark:border-default-700 dark:hover:bg-default-800'
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        <StackedBarChart
          data={data}
          xKey="date"
          series={[
            { key: 'applicationFees', name: 'Application Fees', color: CHART_COLORS.primary },
            { key: 'refunds', name: 'Refunds', color: CHART_COLORS.red },
            { key: 'reimbursements', name: 'Reimbursements', color: CHART_COLORS.blue },
          ]}
          formatValue={v => formatAmount(v, shownCurrency ?? undefined)}
          formatXTick={value => {
            const d = new Date(value)
            if (Number.isNaN(d.getTime())) return value
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }}
        />
      </ChartCard>
    )
  }

  const data = (composition?.buckets ?? []).map(b => ({
    date: b.date,
    applicationFees: b.applicationFees,
    refunds: b.refunds,
    reimbursements: b.reimbursements,
  }))

  return (
    <ChartCard
      title="Revenue Composition"
      description={`Application fees vs refunds vs reimbursements (by ${composition?.bucket ?? 'period'})`}
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('revenueComposition')}
      empty={!loading && data.length === 0}
    >
      <StackedBarChart
        data={data}
        xKey="date"
        series={[
          { key: 'applicationFees', name: 'Application Fees', color: CHART_COLORS.primary },
          { key: 'refunds', name: 'Refunds', color: CHART_COLORS.red },
          { key: 'reimbursements', name: 'Reimbursements', color: CHART_COLORS.blue },
        ]}
        formatValue={fmtMoney}
        formatXTick={value => {
          const d = new Date(value)
          if (Number.isNaN(d.getTime())) return value
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }}
      />
    </ChartCard>
  )
}
