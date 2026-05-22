'use client'

import { Activity, Banknote, Coins, Globe, ShieldAlert, Wallet } from 'lucide-react'
import { KpiCard } from '../shared/kpi-card'
import { CHART_COLORS } from '@/lib/chart-theme'
import { useCurrencyFormat } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

export function FinancialOverviewKpis() {
  const overview = useFinancialStore(s => s.overview)
  const disputes = useFinancialStore(s => s.disputes)
  const loading = useFinancialStore(s => s.loading.overview)
  const currency = useFinancialStore(s => s.currency)
  const fmtMoney = useCurrencyFormat(currency)

  // All Currencies mode: amounts can't be summed cross-currency, so the KPI
  // strip pivots to currency-agnostic counts/rates plus the active currency
  // count. The per-currency revenue/balance breakdown lives in the
  // `CurrencyPerformanceTable` below this strip.
  if (overview?.byCurrency) {
    const activeCount = overview.byCurrency.length
    const paymentsProcessed = (overview.succeededCount ?? 0).toLocaleString()
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          loading={loading}
          label="Currencies Active"
          value={activeCount.toString()}
          icon={<Globe className="h-5 w-5" />}
          iconBgClass="bg-primary-50 dark:bg-primary-900/30"
          iconColorClass="text-primary-600 dark:text-primary-300"
          footer={
            activeCount > 0 ? (
              <p className="text-xs text-default-500">
                Top: {overview.byCurrency[0].currency.toUpperCase()}
              </p>
            ) : null
          }
        />
        <KpiCard
          loading={loading}
          label="Payments Processed"
          value={paymentsProcessed}
          icon={<Coins className="h-5 w-5" />}
          iconBgClass="bg-blue-50 dark:bg-blue-900/30"
          iconColorClass="text-blue-600 dark:text-blue-300"
        />
        <KpiCard
          loading={loading}
          label="Payment Success Rate"
          value={`${overview.paymentSuccessRate}%`}
          icon={<Activity className="h-5 w-5" />}
          iconBgClass="bg-yellow-50 dark:bg-yellow-900/30"
          iconColorClass="text-yellow-600 dark:text-yellow-300"
        />
        <KpiCard
          loading={loading}
          label="Open Dispute Rate"
          value={disputes ? `${disputes.openDisputeRate}%` : '—'}
          icon={<ShieldAlert className="h-5 w-5" />}
          iconBgClass="bg-orange-50 dark:bg-orange-900/30"
          iconColorClass="text-orange-600 dark:text-orange-300"
          invertTrendColor
          footer={
            disputes ? (
              <p className="text-xs text-default-500">
                {disputes.totalDisputes} disputes · {disputes.urgent.length} urgent
              </p>
            ) : null
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        loading={loading || !overview}
        label="Net Revenue"
        value={overview ? fmtMoney(overview.netRevenue) : '—'}
        icon={<Banknote className="h-5 w-5" />}
        iconBgClass="bg-primary-50 dark:bg-primary-900/30"
        iconColorClass="text-primary-600 dark:text-primary-300"
        sparklineColor={CHART_COLORS.primary}
      />
      <KpiCard
        loading={loading || !overview}
        label="GMV Processed"
        value={overview ? fmtMoney(overview.gmvProcessed) : '—'}
        icon={<Coins className="h-5 w-5" />}
        iconBgClass="bg-blue-50 dark:bg-blue-900/30"
        iconColorClass="text-blue-600 dark:text-blue-300"
        sparklineColor={CHART_COLORS.blue}
      />
      <KpiCard
        loading={loading || !overview}
        label="Stripe Balance (available)"
        value={overview ? fmtMoney(overview.balanceAvailable) : '—'}
        icon={<Wallet className="h-5 w-5" />}
        iconBgClass="bg-purple-50 dark:bg-purple-900/30"
        iconColorClass="text-purple-600 dark:text-purple-300"
        footer={
          overview?.balanceError ? (
            <p className="text-xs text-danger-600">Stripe unavailable — showing cached</p>
          ) : overview?.balanceLastUpdated ? (
            <p className="text-xs text-default-500">
              Updated {formatRelativeTime(overview.balanceLastUpdated)}
            </p>
          ) : null
        }
      />
      <KpiCard
        loading={loading || !overview}
        label="Stripe Balance (pending)"
        value={overview ? fmtMoney(overview.balancePending) : '—'}
        icon={<Wallet className="h-5 w-5" />}
        iconBgClass="bg-orange-50 dark:bg-orange-900/30"
        iconColorClass="text-orange-600 dark:text-orange-300"
      />
      <KpiCard
        loading={loading || !overview}
        label="Payment Success Rate"
        value={overview ? `${overview.paymentSuccessRate}%` : '—'}
        icon={<Activity className="h-5 w-5" />}
        iconBgClass="bg-yellow-50 dark:bg-yellow-900/30"
        iconColorClass="text-yellow-600 dark:text-yellow-300"
        invertTrendColor={false}
      />
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'recently'
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
