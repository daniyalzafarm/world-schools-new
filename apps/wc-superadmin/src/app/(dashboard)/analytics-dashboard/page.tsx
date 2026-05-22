'use client'

import { Button } from '@heroui/react'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PageSlot } from '@/components/layout/page-slot'
import { BookingStatusDonut } from '@/components/dashboard/analytics/booking-status-donut'
import { ConversionFunnel } from '@/components/dashboard/analytics/conversion-funnel'
import { GeographicDistributionWidget } from '@/components/dashboard/analytics/geographic-distribution'
import { OverviewKpis } from '@/components/dashboard/analytics/overview-kpis'
import { RevenueChart } from '@/components/dashboard/analytics/revenue-chart'
import { TopProvidersList } from '@/components/dashboard/analytics/top-providers-list'
import { CurrencySelector } from '@/components/dashboard/shared/currency-selector'
import { DateRangePicker } from '@/components/dashboard/shared/date-range-picker'
import { useAnalyticsStore } from '@/stores/analytics-store'

export default function AnalyticsDashboardPage() {
  const range = useAnalyticsStore(s => s.range)
  const currency = useAnalyticsStore(s => s.currency)
  const currencies = useAnalyticsStore(s => s.currencies)
  const loadingCurrencies = useAnalyticsStore(s => s.loading.currencies)
  const setRange = useAnalyticsStore(s => s.setRange)
  const setCurrency = useAnalyticsStore(s => s.setCurrency)
  const fetchAll = useAnalyticsStore(s => s.fetchAll)
  const fetchCurrencies = useAnalyticsStore(s => s.fetchCurrencies)

  const initRef = useRef(false)

  // Mount: load the currency list once. Don't fetch widgets here —
  // the reactive effect below handles that once currency settles.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void fetchCurrencies()
  }, [])

  // Reactive: fetch widgets when range/currency settles. Gate prevents the
  // initial "currency=undefined" fetch that would otherwise return a
  // multi-currency aggregate and flicker against the real per-currency view.
  useEffect(() => {
    if (loadingCurrencies) return
    if (!currency && currencies.length > 0) return
    void fetchAll()
  }, [range, currency, currencies.length, loadingCurrencies])

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Platform Analytics
            </h1>
            <p className="mt-1 text-default-600">
              Comprehensive insights into platform performance and growth
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CurrencySelector
              currencies={currencies}
              value={currency}
              onChange={setCurrency}
              loading={loadingCurrencies}
            />
            <DateRangePicker value={range} onChange={setRange} />
            <Button
              size="sm"
              variant="flat"
              startContent={<RefreshCw className="h-4 w-4" />}
              onPress={() => void fetchAll()}
            >
              Refresh
            </Button>
          </div>
        </header>

        <OverviewKpis />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <BookingStatusDonut />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TopProvidersList />
          <GeographicDistributionWidget />
        </div>

        <ConversionFunnel />
      </section>
    </PageSlot>
  )
}
