'use client'

import { Banknote, ClipboardList, Coins, TrendingUp, Users } from 'lucide-react'
import { KpiCard } from '../shared/kpi-card'
import { CHART_COLORS } from '@/lib/chart-theme'
import { useCurrencyFormat } from '@/hooks/use-currency-format'
import { useAnalyticsStore } from '@/stores/analytics-store'

export function OverviewKpis() {
  const overview = useAnalyticsStore(s => s.overview)
  const loading = useAnalyticsStore(s => s.loading.overview)
  const currency = useAnalyticsStore(s => s.currency)
  const fmtMoney = useCurrencyFormat(currency)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        loading={loading || !overview}
        label="Total GMV"
        value={overview ? fmtMoney(overview.gmv.value) : '—'}
        icon={<Banknote className="h-5 w-5" />}
        iconBgClass="bg-primary-50 dark:bg-primary-900/30"
        iconColorClass="text-primary-600 dark:text-primary-300"
        trendPct={overview?.gmv.trendPct}
        sparkline={overview?.gmv.sparkline}
        sparklineColor={CHART_COLORS.primary}
      />
      <KpiCard
        loading={loading || !overview}
        label="Platform Revenue"
        value={overview ? fmtMoney(overview.platformRevenue.value) : '—'}
        icon={<Coins className="h-5 w-5" />}
        iconBgClass="bg-blue-50 dark:bg-blue-900/30"
        iconColorClass="text-blue-600 dark:text-blue-300"
        trendPct={overview?.platformRevenue.trendPct}
        sparkline={overview?.platformRevenue.sparkline}
        sparklineColor={CHART_COLORS.blue}
      />
      <KpiCard
        loading={loading || !overview}
        label="Total Bookings"
        value={overview ? overview.bookings.value.toLocaleString() : '—'}
        icon={<ClipboardList className="h-5 w-5" />}
        iconBgClass="bg-purple-50 dark:bg-purple-900/30"
        iconColorClass="text-purple-600 dark:text-purple-300"
        trendPct={overview?.bookings.trendPct}
        sparkline={overview?.bookings.sparkline}
        sparklineColor={CHART_COLORS.purple}
      />
      <KpiCard
        loading={loading || !overview}
        label="Active Parents"
        value={overview ? overview.activeParents.value.toLocaleString() : '—'}
        icon={<Users className="h-5 w-5" />}
        iconBgClass="bg-orange-50 dark:bg-orange-900/30"
        iconColorClass="text-orange-600 dark:text-orange-300"
        trendPct={overview?.activeParents.trendPct}
        sparkline={overview?.activeParents.sparkline}
        sparklineColor={CHART_COLORS.orange}
      />
      <KpiCard
        loading={loading || !overview}
        label="Conversion Rate"
        value={overview ? `${overview.conversionRate.value}%` : '—'}
        icon={<TrendingUp className="h-5 w-5" />}
        iconBgClass="bg-yellow-50 dark:bg-yellow-900/30"
        iconColorClass="text-yellow-600 dark:text-yellow-300"
        trendPct={overview?.conversionRate.trendPct}
        sparkline={overview?.conversionRate.sparkline}
        sparklineColor={CHART_COLORS.yellow}
      />
    </div>
  )
}
