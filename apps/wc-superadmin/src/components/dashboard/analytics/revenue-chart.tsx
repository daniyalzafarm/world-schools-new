'use client'

import { ChartCard } from '../shared/chart-card'
import { ColumnChart } from '../charts/column-chart'
import { CHART_COLORS } from '@/lib/chart-theme'
import { useCurrencyFormat } from '@/hooks/use-currency-format'
import { useAnalyticsStore } from '@/stores/analytics-store'

export function RevenueChart() {
  const revenue = useAnalyticsStore(s => s.revenue)
  const loading = useAnalyticsStore(s => s.loading.revenue)
  const error = useAnalyticsStore(s => s.errors.revenue)
  const currency = useAnalyticsStore(s => s.currency)
  const fetchWidget = useAnalyticsStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const data = (revenue?.buckets ?? []).map(b => ({
    date: b.date,
    gmv: b.gmv,
    platformRevenue: b.platformRevenue,
  }))

  return (
    <ChartCard
      title="Revenue & GMV"
      description={`Bucketed by ${revenue?.bucket ?? 'period'}`}
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('revenue')}
      empty={!loading && data.length === 0}
    >
      <ColumnChart
        data={data}
        xKey="date"
        series={[
          { key: 'gmv', name: 'GMV', color: CHART_COLORS.primary },
          { key: 'platformRevenue', name: 'Platform Revenue', color: CHART_COLORS.blue },
        ]}
        formatValue={fmtMoney}
        formatXTick={formatBucketLabel(revenue?.bucket)}
      />
    </ChartCard>
  )
}

function formatBucketLabel(bucket?: 'day' | 'week' | 'month') {
  return (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    if (bucket === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}
