'use client'

import { Button } from '@heroui/react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PageSlot } from '@/components/layout/page-slot'
import { ConnectedAccountsTable } from '@/components/dashboard/financial/connected-accounts-table'
import { CurrencyPerformanceTable } from '@/components/dashboard/financial/currency-performance-table'
import { DisputesSummary } from '@/components/dashboard/financial/disputes-summary'
import { FinancialOverviewKpis } from '@/components/dashboard/financial/financial-overview-kpis'
import { PaymentStatusDonut } from '@/components/dashboard/financial/payment-status-donut'
import { RefundsSummary } from '@/components/dashboard/financial/refunds-summary'
import { ReimbursementsAging } from '@/components/dashboard/financial/reimbursements-aging'
import { RevenueCompositionChart } from '@/components/dashboard/financial/revenue-composition-chart'
import { UpcomingPayoutsList } from '@/components/dashboard/financial/upcoming-payouts-list'
import { CurrencySelector } from '@/components/dashboard/shared/currency-selector'
import { DateRangePicker } from '@/components/dashboard/shared/date-range-picker'
import { useFinancialStore } from '@/stores/financial-store'

export default function FinancialDashboardPage() {
  const range = useFinancialStore(s => s.range)
  const currency = useFinancialStore(s => s.currency)
  const currencies = useFinancialStore(s => s.currencies)
  const loadingCurrencies = useFinancialStore(s => s.loading.currencies)
  const setRange = useFinancialStore(s => s.setRange)
  const setCurrency = useFinancialStore(s => s.setCurrency)
  const fetchAll = useFinancialStore(s => s.fetchAll)
  const fetchCurrencies = useFinancialStore(s => s.fetchCurrencies)

  const initRef = useRef(false)

  // Mount: load the currency list once. Don't fetch widgets here —
  // the reactive effect below handles that once currency settles.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void fetchCurrencies()
  }, [])

  // Reactive: fetch widgets when range/currency settles. `currency=undefined`
  // is now a first-class "All Currencies" state, so it should trigger a fetch
  // rather than being suppressed.
  useEffect(() => {
    if (loadingCurrencies) return
    void fetchAll()
  }, [range, currency, loadingCurrencies])

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Financial Dashboard
            </h1>
            <p className="mt-1 text-default-600">
              Revenue, Stripe balance, payouts, disputes, and platform health
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
            <Button
              size="sm"
              variant="flat"
              as="a"
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noreferrer"
              endContent={<ExternalLink className="h-4 w-4" />}
            >
              Stripe
            </Button>
          </div>
        </header>

        <FinancialOverviewKpis />

        <CurrencyPerformanceTable />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueCompositionChart />
          </div>
          <PaymentStatusDonut />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <UpcomingPayoutsList />
          <DisputesSummary />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RefundsSummary />
          <ReimbursementsAging />
        </div>

        <ConnectedAccountsTable />
      </section>
    </PageSlot>
  )
}
