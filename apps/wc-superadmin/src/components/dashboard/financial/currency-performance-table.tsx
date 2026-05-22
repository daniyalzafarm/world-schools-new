'use client'

import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useMemo } from 'react'
import { ChartCard } from '../shared/chart-card'
import { formatAmount } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

interface Row {
  currency: string
  gmv: number
  netRevenue: number
  payments: number
  successRate: number
  refundCount: number
  refundRate: number
  disputeCount: number
  disputeRate: number
  pendingPayouts: number
  available: number
  pending: number
}

/**
 * Aggregates the per-currency breakdowns from the other widgets into a single
 * table — the centerpiece of the All Currencies view. Renders only when the
 * dashboard is in All Currencies mode (no specific currency selected).
 */
export function CurrencyPerformanceTable() {
  const currency = useFinancialStore(s => s.currency)
  const overview = useFinancialStore(s => s.overview)
  const disputes = useFinancialStore(s => s.disputes)
  const refunds = useFinancialStore(s => s.refunds)
  const payouts = useFinancialStore(s => s.upcomingPayouts)
  // Drive loading/error from overview only — it's the primary source that
  // populates the rows. disputes/refunds/payouts are enrichments and the
  // table can render without flicker while they catch up.
  const loading = useFinancialStore(s => s.loading.overview)
  const error = useFinancialStore(s => s.errors.overview)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)

  const rows = useMemo<Row[]>(() => {
    if (currency) return []
    if (!overview?.byCurrency) return []

    const disputesByCurrency = new Map((disputes?.byCurrency ?? []).map(d => [d.currency, d]))
    const refundsByCurrency = new Map((refunds?.byCurrency ?? []).map(r => [r.currency, r]))
    const payoutsByCurrency = new Map(
      (payouts?.totalsByCurrency ?? []).map(p => [p.currency, p.amount])
    )

    return overview.byCurrency
      .map<Row>(o => {
        const d = disputesByCurrency.get(o.currency)
        const r = refundsByCurrency.get(o.currency)
        const successRate =
          o.paymentsCount > 0 ? Math.round((o.succeededCount / o.paymentsCount) * 100) : 0
        const refundRate =
          o.paymentsCount > 0 ? Math.round(((r?.count ?? 0) / o.paymentsCount) * 10000) / 100 : 0
        return {
          currency: o.currency,
          gmv: o.gmvProcessed,
          netRevenue: o.netRevenue,
          payments: o.paymentsCount,
          successRate,
          refundCount: r?.count ?? 0,
          refundRate,
          disputeCount: d?.count ?? 0,
          disputeRate: d?.openRate ?? 0,
          pendingPayouts: payoutsByCurrency.get(o.currency) ?? 0,
          available: o.balanceAvailable,
          pending: o.balancePending,
        }
      })
      .sort((a, b) => b.gmv - a.gmv)
  }, [currency, overview, disputes, refunds, payouts])

  if (currency) return null

  return (
    <ChartCard
      title="Currency Performance"
      description="Per-currency breakdown across all key financial metrics"
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('overview')}
      empty={!loading && rows.length === 0}
      emptyMessage="No currency activity in this range."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table aria-label="Per-currency performance" removeWrapper>
          <TableHeader>
            <TableColumn>CURRENCY</TableColumn>
            <TableColumn>GMV</TableColumn>
            <TableColumn>NET REVENUE</TableColumn>
            <TableColumn>PAYMENTS</TableColumn>
            <TableColumn>SUCCESS</TableColumn>
            <TableColumn>REFUNDS</TableColumn>
            <TableColumn>DISPUTES</TableColumn>
            <TableColumn>PENDING PAYOUTS</TableColumn>
            <TableColumn>AVAILABLE / PENDING</TableColumn>
          </TableHeader>
          <TableBody items={rows} emptyContent="No currency activity in this range.">
            {row => (
              <TableRow key={row.currency}>
                <TableCell>
                  <span className="text-sm font-semibold uppercase text-foreground">
                    {row.currency}
                  </span>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatAmount(row.gmv, row.currency)}
                </TableCell>
                <TableCell>{formatAmount(row.netRevenue, row.currency)}</TableCell>
                <TableCell>{row.payments.toLocaleString()}</TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={
                      row.successRate >= 95
                        ? 'success'
                        : row.successRate >= 80
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {row.successRate}%
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-default-500">{row.refundCount}</span>{' '}
                  <span className="text-sm text-default-700 dark:text-default-200">
                    ({row.refundRate}%)
                  </span>
                </TableCell>
                <TableCell>
                  {row.disputeCount > 0 ? (
                    <>
                      <span className="text-xs text-default-500">{row.disputeCount}</span>{' '}
                      <span className="text-sm text-default-700 dark:text-default-200">
                        ({row.disputeRate}%)
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.pendingPayouts > 0 ? (
                    formatAmount(row.pendingPayouts, row.currency)
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="font-semibold text-foreground">
                      {formatAmount(row.available, row.currency)}
                    </span>
                    <span className="ml-1 text-xs text-default-400">
                      / {formatAmount(row.pending, row.currency)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  )
}
