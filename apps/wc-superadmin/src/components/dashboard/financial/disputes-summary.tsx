'use client'

import { AlertCircle } from 'lucide-react'
import { ChartCard } from '../shared/chart-card'
import { DonutChart } from '../charts/donut-chart'
import { CHART_COLORS, formatStatusLabel, STATUS_COLOR_MAP } from '@/lib/chart-theme'
import { formatAmount, useCurrencyFormat } from '@/hooks/use-currency-format'
import { pluralize } from '@/lib/format'
import { useFinancialStore } from '@/stores/financial-store'

export function DisputesSummary() {
  const disputes = useFinancialStore(s => s.disputes)
  const loading = useFinancialStore(s => s.loading.disputes)
  const error = useFinancialStore(s => s.errors.disputes)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const isAllCurrencies = !currency

  const slices = disputes
    ? Object.entries(disputes.byOutcome).map(([outcome, info]) => ({
        name: formatStatusLabel(outcome),
        value: info.count,
        color: STATUS_COLOR_MAP[outcome] ?? CHART_COLORS.gray,
      }))
    : []

  return (
    <ChartCard
      title="Dispute Activity"
      description={
        disputes
          ? `${disputes.totalDisputes} ${pluralize(disputes.totalDisputes, 'dispute')} · ${disputes.openDisputeRate}% open rate`
          : ''
      }
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('disputes')}
      empty={!loading && (!disputes || disputes.totalDisputes === 0)}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <DonutChart
          slices={slices}
          centerLabel="disputes"
          centerValue={disputes?.totalDisputes ?? 0}
        />
        <div className="space-y-2">
          {isAllCurrencies && disputes?.byCurrency && disputes.byCurrency.length > 0 ? (
            <>
              <div className="text-sm font-semibold text-foreground">By Currency</div>
              <ul className="space-y-1.5">
                {disputes.byCurrency.slice(0, 6).map(row => (
                  <li
                    key={row.currency}
                    className="flex items-center justify-between gap-2 rounded-md bg-default-50 px-2.5 py-1.5 text-xs dark:bg-default-800/40"
                  >
                    <div className="font-semibold uppercase text-default-700 dark:text-default-200">
                      {row.currency}
                    </div>
                    <div className="text-default-500">
                      {row.count} {pluralize(row.count, 'dispute')} · {row.openRate}% rate
                    </div>
                    <div className="font-semibold">{formatAmount(row.amount, row.currency)}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertCircle className="h-4 w-4 text-warning-500" />
                Urgent ({disputes?.urgent.length ?? 0})
              </div>
              {disputes && disputes.urgent.length > 0 ? (
                <ul className="space-y-1.5">
                  {disputes.urgent.slice(0, 5).map(d => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-warning-50 px-2.5 py-1.5 text-xs dark:bg-warning-900/20"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">
                          {d.providerName}
                        </div>
                        {d.evidenceDueBy && (
                          <div className="text-default-500">
                            Evidence due {new Date(d.evidenceDueBy).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 font-semibold">{fmtMoney(d.amount)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-default-500">No urgent disputes.</p>
              )}
            </>
          )}
          {isAllCurrencies && disputes && disputes.urgent.length > 0 && (
            <div className="mt-3 border-t border-default-200 pt-2 dark:border-default-700/50">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-700 dark:text-warning-300">
                <AlertCircle className="h-3.5 w-3.5" />
                {disputes.urgent.length} urgent — evidence due within 72h
              </div>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  )
}
