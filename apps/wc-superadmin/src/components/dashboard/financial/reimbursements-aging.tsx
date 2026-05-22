'use client'

import { Card, CardBody } from '@heroui/react'
import { ChartCard } from '../shared/chart-card'
import { ProgressRow } from '../shared/progress-row'
import { formatAmount, useCurrencyFormat } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

export function ReimbursementsAging() {
  const reimb = useFinancialStore(s => s.reimbursements)
  const loading = useFinancialStore(s => s.loading.reimbursements)
  const error = useFinancialStore(s => s.errors.reimbursements)
  const currency = useFinancialStore(s => s.currency)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const isAllCurrencies = !currency
  const buckets = reimb?.byBucket
  const max = buckets
    ? Math.max(buckets.current.count, buckets.weekOverdue.count, buckets.monthOverdue.count, 1)
    : 1

  // In All Currencies mode amounts are zero on `byBucket` (cross-currency
  // summing isn't valid), so the progress bars are driven by count instead of
  // amount. Currency totals live in the breakdown below.
  const description = (() => {
    if (!reimb) return 'Outstanding reimbursements owed to platform'
    if (isAllCurrencies) {
      const distinct = reimb.pendingTotalsByCurrency?.length ?? 0
      return `${reimb.byStatus.pending.count + reimb.byStatus.invoiced.count} outstanding across ${distinct} ${distinct === 1 ? 'currency' : 'currencies'}`
    }
    return `Outstanding reimbursements owed to platform — ${fmtMoney(reimb.pendingTotal)}`
  })()

  const totalItems = reimb ? reimb.byStatus.pending.count + reimb.byStatus.invoiced.count : 0

  return (
    <ChartCard
      title="Reimbursement Aging"
      description={description}
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('reimbursements')}
      empty={!loading && totalItems === 0}
    >
      <div className="space-y-4">
        {buckets && (
          <>
            <ProgressRow
              label={buckets.current.label}
              value={
                isAllCurrencies ? (
                  `${buckets.current.count} items`
                ) : (
                  <>
                    <span className="text-xs text-default-400 mr-1.5">{buckets.current.count}</span>
                    {fmtMoney(buckets.current.amount)}
                  </>
                )
              }
              percent={
                isAllCurrencies
                  ? Math.round((buckets.current.count / max) * 100)
                  : Math.round(
                      (buckets.current.amount /
                        Math.max(
                          buckets.current.amount,
                          buckets.weekOverdue.amount,
                          buckets.monthOverdue.amount,
                          1
                        )) *
                        100
                    )
              }
              colorClass="bg-primary-500"
            />
            <ProgressRow
              label={buckets.weekOverdue.label}
              value={
                isAllCurrencies ? (
                  `${buckets.weekOverdue.count} items`
                ) : (
                  <>
                    <span className="text-xs text-default-400 mr-1.5">
                      {buckets.weekOverdue.count}
                    </span>
                    {fmtMoney(buckets.weekOverdue.amount)}
                  </>
                )
              }
              percent={
                isAllCurrencies
                  ? Math.round((buckets.weekOverdue.count / max) * 100)
                  : Math.round(
                      (buckets.weekOverdue.amount /
                        Math.max(
                          buckets.current.amount,
                          buckets.weekOverdue.amount,
                          buckets.monthOverdue.amount,
                          1
                        )) *
                        100
                    )
              }
              colorClass="bg-orange-500"
            />
            <ProgressRow
              label={buckets.monthOverdue.label}
              value={
                isAllCurrencies ? (
                  `${buckets.monthOverdue.count} items`
                ) : (
                  <>
                    <span className="text-xs text-default-400 mr-1.5">
                      {buckets.monthOverdue.count}
                    </span>
                    {fmtMoney(buckets.monthOverdue.amount)}
                  </>
                )
              }
              percent={
                isAllCurrencies
                  ? Math.round((buckets.monthOverdue.count / max) * 100)
                  : Math.round(
                      (buckets.monthOverdue.amount /
                        Math.max(
                          buckets.current.amount,
                          buckets.weekOverdue.amount,
                          buckets.monthOverdue.amount,
                          1
                        )) *
                        100
                    )
              }
              colorClass="bg-red-500"
            />
          </>
        )}
        {reimb && !isAllCurrencies && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Card shadow="none" className="border border-default-200">
              <CardBody className="p-3">
                <div className="text-xs text-default-500">Pending</div>
                <div className="text-lg font-bold text-foreground">
                  {fmtMoney(reimb.byStatus.pending.amount)}
                </div>
                <div className="text-xs text-default-400">{reimb.byStatus.pending.count} items</div>
              </CardBody>
            </Card>
            <Card shadow="none" className="border border-default-200">
              <CardBody className="p-3">
                <div className="text-xs text-default-500">Invoiced</div>
                <div className="text-lg font-bold text-foreground">
                  {fmtMoney(reimb.byStatus.invoiced.amount)}
                </div>
                <div className="text-xs text-default-400">
                  {reimb.byStatus.invoiced.count} items
                </div>
              </CardBody>
            </Card>
          </div>
        )}
        {isAllCurrencies &&
          reimb?.pendingTotalsByCurrency &&
          reimb.pendingTotalsByCurrency.length > 0 && (
            <div className="border-t border-default-200 pt-3 dark:border-default-700/50">
              <div className="mb-2 text-xs font-semibold uppercase text-default-500">
                Outstanding by Currency
              </div>
              <ul className="space-y-1">
                {reimb.pendingTotalsByCurrency.map(row => (
                  <li
                    key={row.currency}
                    className="flex items-center justify-between text-xs text-default-700 dark:text-default-200"
                  >
                    <span className="font-semibold uppercase">{row.currency}</span>
                    <span>{formatAmount(row.amount, row.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </ChartCard>
  )
}
