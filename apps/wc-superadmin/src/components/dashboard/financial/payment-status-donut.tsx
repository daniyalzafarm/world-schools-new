'use client'

import { ChartCard } from '../shared/chart-card'
import { DonutChart } from '../charts/donut-chart'
import { CHART_COLORS, formatStatusLabel, STATUS_COLOR_MAP } from '@/lib/chart-theme'
import { useFinancialStore } from '@/stores/financial-store'

export function PaymentStatusDonut() {
  const data = useFinancialStore(s => s.paymentStatus)
  const loading = useFinancialStore(s => s.loading.paymentStatus)
  const error = useFinancialStore(s => s.errors.paymentStatus)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)

  const isAllCurrencies = !currency

  const slices =
    data?.slices.map(s => ({
      name: formatStatusLabel(s.status),
      value: s.count,
      color: STATUS_COLOR_MAP[s.status] ?? CHART_COLORS.gray,
    })) ?? []
  const total = slices.reduce((s, x) => s + x.value, 0)

  return (
    <ChartCard
      title="Payment Status"
      description={
        isAllCurrencies
          ? 'PaymentIntent status across all currencies (counts)'
          : 'PaymentIntent status across connected accounts'
      }
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('paymentStatus')}
      empty={!loading && slices.length === 0}
    >
      <DonutChart slices={slices} centerLabel="payments" centerValue={total} />
    </ChartCard>
  )
}
