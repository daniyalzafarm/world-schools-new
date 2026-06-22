'use client'

import { ChartCard } from '../shared/chart-card'
import { FunnelChart } from '../charts/funnel-chart'
import { useAnalyticsStore } from '@/stores/analytics-store'

export function ConversionFunnel() {
  const funnel = useAnalyticsStore(s => s.funnel)
  const loading = useAnalyticsStore(s => s.loading.funnel)
  const error = useAnalyticsStore(s => s.errors.funnel)
  const fetchWidget = useAnalyticsStore(s => s.fetchWidget)

  const steps = funnel?.steps ?? []

  return (
    <ChartCard
      title="Booking Conversion Funnel"
      description="From checkout to paid in full"
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('funnel')}
      empty={!loading && steps.length === 0}
    >
      <FunnelChart steps={steps} />
    </ChartCard>
  )
}
