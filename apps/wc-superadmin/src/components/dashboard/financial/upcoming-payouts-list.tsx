'use client'

import { Chip } from '@heroui/react'
import { useMemo } from 'react'
import { ChartCard } from '../shared/chart-card'
import { formatStatusLabel } from '@/lib/chart-theme'
import { formatAmount, useCurrencyFormat } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'
import type { UpcomingPayoutTranche } from '@/types/financial'

export function UpcomingPayoutsList() {
  const payouts = useFinancialStore(s => s.upcomingPayouts)
  const loading = useFinancialStore(s => s.loading.upcomingPayouts)
  const error = useFinancialStore(s => s.errors.upcomingPayouts)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const tranches = payouts?.tranches ?? []
  const isAllCurrencies = !currency

  // In All Currencies mode, render tranches grouped under a currency header so
  // amounts on the right are always comparable to their section header total.
  const grouped = useMemo(() => {
    if (!isAllCurrencies) return null
    const m = new Map<string, UpcomingPayoutTranche[]>()
    for (const t of tranches) {
      const c = t.currency
      const arr = m.get(c) ?? []
      arr.push(t)
      m.set(c, arr)
    }
    // Mirror the order of `totalsByCurrency` (sorted by amount desc on the
    // backend) so the biggest exposure currencies appear first.
    const order = payouts?.totalsByCurrency?.map(x => x.currency) ?? Array.from(m.keys())
    return order.filter(c => m.has(c)).map(c => ({ currency: c, items: m.get(c)! }))
  }, [isAllCurrencies, tranches, payouts])

  const description = (() => {
    if (!payouts) return 'Tranches scheduled to release soon'
    if (isAllCurrencies) {
      const total = payouts.totalsByCurrency?.length ?? 0
      return `${payouts.count} pending across ${total} ${total === 1 ? 'currency' : 'currencies'}`
    }
    return `${payouts.count} pending · ${fmtMoney(payouts.totalAmount)} total`
  })()

  return (
    <ChartCard
      title="Upcoming Payouts (next 7 days)"
      description={description}
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('upcomingPayouts')}
      empty={!loading && tranches.length === 0}
      bodyClassName="max-h-96 overflow-y-auto"
    >
      {grouped ? (
        <div className="space-y-4">
          {grouped.map(({ currency: c, items }) => {
            const total = payouts?.totalsByCurrency?.find(x => x.currency === c)?.amount ?? 0
            return (
              <div key={c}>
                <div className="mb-1.5 flex items-center justify-between border-b border-default-200 pb-1 text-xs font-semibold uppercase text-default-500 dark:border-default-700/50">
                  <span>{c.toUpperCase()}</span>
                  <span>
                    {items.length} · {formatAmount(total, c)}
                  </span>
                </div>
                <ul className="divide-y divide-default-200 dark:divide-default-700/50">
                  {items.map(t => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {t.providerName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-default-500">
                          <Chip size="sm" variant="flat" color="primary" radius="sm">
                            {formatStatusLabel(t.reason)}
                          </Chip>
                          <span>·</span>
                          <span>{new Date(t.releaseAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold">
                        {formatAmount(t.amount, t.currency)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <ul className="divide-y divide-default-200 dark:divide-default-700/50">
          {tranches.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {t.providerName}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-default-500">
                  <Chip size="sm" variant="flat" color="primary" radius="sm">
                    {formatStatusLabel(t.reason)}
                  </Chip>
                  <span>·</span>
                  <span>{new Date(t.releaseAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-semibold">{fmtMoney(t.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
