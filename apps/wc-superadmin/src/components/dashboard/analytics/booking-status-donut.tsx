'use client'

import { ChartCard } from '../shared/chart-card'
import { DonutChart } from '../charts/donut-chart'
import { CHART_COLORS, formatStatusLabel, STATUS_COLOR_MAP } from '@/lib/chart-theme'
import { useAnalyticsStore } from '@/stores/analytics-store'

export function BookingStatusDonut() {
  const data = useAnalyticsStore(s => s.bookingStatus)
  const loading = useAnalyticsStore(s => s.loading.bookingStatus)
  const error = useAnalyticsStore(s => s.errors.bookingStatus)
  const fetchWidget = useAnalyticsStore(s => s.fetchWidget)

  const slices =
    data?.slices.map(s => ({
      name: formatStatusLabel(s.status),
      value: s.count,
      color: STATUS_COLOR_MAP[s.status] ?? CHART_COLORS.gray,
    })) ?? []

  return (
    <ChartCard
      title="Booking Status"
      description="Distribution of all bookings by lifecycle state"
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('bookingStatus')}
      empty={!loading && slices.length === 0}
    >
      <DonutChart
        slices={slices}
        centerLabel="bookings"
        centerValue={data?.total ?? 0}
        height={280}
      />
    </ChartCard>
  )
}
