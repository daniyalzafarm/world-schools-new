'use client'

import {
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react'
import { ChartCard } from '../shared/chart-card'
import { formatAmount } from '@/hooks/use-currency-format'
import { useFinancialStore } from '@/stores/financial-store'

export function ConnectedAccountsTable() {
  const accounts = useFinancialStore(s => s.connectedAccounts)
  const loading = useFinancialStore(s => s.loading.connectedAccounts)
  const error = useFinancialStore(s => s.errors.connectedAccounts)
  const fetchWidget = useFinancialStore(s => s.fetchWidget)

  const providers = accounts?.providers ?? []

  return (
    <ChartCard
      title="Connected Account Health"
      description="Top providers by GMV with their Stripe Connect status"
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('connectedAccounts')}
      empty={!loading && providers.length === 0}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table aria-label="Connected accounts health" removeWrapper>
          <TableHeader>
            <TableColumn>PROVIDER</TableColumn>
            <TableColumn>CURRENCY</TableColumn>
            <TableColumn>GMV</TableColumn>
            <TableColumn>CHARGES</TableColumn>
            <TableColumn>PAYOUTS</TableColumn>
            <TableColumn>ATTENTION</TableColumn>
            <TableColumn>LAST PAYOUT</TableColumn>
            <TableColumn>PAYOUT SUCCESS</TableColumn>
          </TableHeader>
          <TableBody items={providers} emptyContent="No providers in this window.">
            {p => (
              <TableRow key={`${p.id}-${p.currency}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" radius="md" src={p.logoUrl ?? undefined} name={p.name} />
                    <span className="font-semibold text-foreground">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold uppercase text-default-600 dark:text-default-300">
                    {p.currency}
                  </span>
                </TableCell>
                <TableCell>{formatAmount(p.gmv, p.currency)}</TableCell>
                <TableCell>
                  <StatusIcon enabled={p.chargesEnabled} />
                </TableCell>
                <TableCell>
                  <StatusIcon enabled={p.payoutsEnabled} />
                </TableCell>
                <TableCell>
                  {p.attentionRequired ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      startContent={<TriangleAlert className="h-3 w-3" />}
                    >
                      Action needed
                    </Chip>
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.lastPayoutDate ? (
                    <span className="text-sm text-default-600">
                      {new Date(p.lastPayoutDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.payoutSuccessRate !== null ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        p.payoutSuccessRate >= 95
                          ? 'success'
                          : p.payoutSuccessRate >= 80
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {p.payoutSuccessRate}%
                    </Chip>
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  )
}

function StatusIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircle2 className="h-4 w-4 text-success-500" />
  ) : (
    <XCircle className="h-4 w-4 text-danger-500" />
  )
}
