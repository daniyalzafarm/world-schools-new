'use client'

import { Avatar } from '@heroui/react'
import { getCountryName } from '@world-schools/ui-web'
import { ChartCard } from '../shared/chart-card'
import { RankedList, RankedListRow } from '../shared/ranked-list'
import { useCurrencyFormat } from '@/hooks/use-currency-format'
import { useAnalyticsStore } from '@/stores/analytics-store'

export function TopProvidersList() {
  const providers = useAnalyticsStore(s => s.topProviders)
  const loading = useAnalyticsStore(s => s.loading.topProviders)
  const error = useAnalyticsStore(s => s.errors.topProviders)
  const currency = useAnalyticsStore(s => s.currency)
  const fetchWidget = useAnalyticsStore(s => s.fetchWidget)
  const fmtMoney = useCurrencyFormat(currency)

  const list = providers ?? []

  return (
    <ChartCard
      title="Top Performing Providers"
      description="Ranked by GMV in this window"
      loading={loading}
      error={error}
      onRetry={() => void fetchWidget('topProviders')}
      empty={!loading && list.length === 0}
      bodyClassName="px-2"
    >
      <RankedList>
        {list.map((p, i) => (
          <RankedListRow
            key={p.id}
            rank={i + 1}
            avatar={
              <Avatar
                size="sm"
                src={p.logoUrl ?? undefined}
                name={p.name}
                radius="md"
                className="shrink-0"
              />
            }
            primary={p.name}
            secondary={
              <>
                {[p.city, getCountryName(p.country)].filter(Boolean).join(', ') || '—'}
                <span className="mx-1.5 text-default-300">·</span>
                {p.bookingCount} bookings
              </>
            }
            right={fmtMoney(p.gmv)}
          />
        ))}
      </RankedList>
    </ChartCard>
  )
}
