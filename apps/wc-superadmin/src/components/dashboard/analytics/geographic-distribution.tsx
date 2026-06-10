'use client'

import { Tab, Tabs } from '@heroui/react'
import { getCountryName } from '@world-schools/ui-web'
import { useEffect, useRef, useState } from 'react'
import { ChartCard } from '../shared/chart-card'
import { ProgressRow } from '../shared/progress-row'
import { formatCompactNumber, useCurrencyFormat } from '@/hooks/use-currency-format'
import { analyticsService } from '@/services/analytics.services'
import { useAnalyticsStore } from '@/stores/analytics-store'
import type { GeographicDistribution } from '@/types/analytics'

type Metric = 'gmv' | 'bookings' | 'parents'

export function GeographicDistributionWidget() {
  const range = useAnalyticsStore(s => s.range)
  const currency = useAnalyticsStore(s => s.currency)
  const currencies = useAnalyticsStore(s => s.currencies)
  const fmtMoney = useCurrencyFormat(currency)

  const [metric, setMetric] = useState<Metric>('gmv')
  const [data, setData] = useState<GeographicDistribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reqRef = useRef(0)

  // Wait for currency to settle before fetching — mirrors the page-level gate
  // so we don't kick off a no-currency request that races against the right one.
  const shouldFetch = !!currency || currencies.length === 0

  const load = async (m: Metric) => {
    if (!shouldFetch) return
    const id = ++reqRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsService.getGeographicDistribution(range, currency, m)
      if (id !== reqRef.current) return
      setData(res)
    } catch (err: any) {
      if (id !== reqRef.current) return
      setError(err.message ?? 'Failed to load geographic data')
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!shouldFetch) return
    void load(metric)
  }, [range, currency, metric, shouldFetch])

  const list = data?.countries ?? []
  const formatValue = (v: number) => {
    if (metric === 'gmv') return fmtMoney(v)
    return formatCompactNumber(v)
  }

  return (
    <ChartCard
      title="Geographic Distribution"
      description="Country breakdown by provider location"
      loading={loading}
      error={error}
      onRetry={() => void load(metric)}
      empty={!loading && list.length === 0}
      actions={
        <Tabs
          aria-label="Metric"
          size="sm"
          variant="solid"
          selectedKey={metric}
          onSelectionChange={k => setMetric(k as Metric)}
        >
          <Tab key="gmv" title="GMV" />
          <Tab key="bookings" title="Bookings" />
          <Tab key="parents" title="Parents" />
        </Tabs>
      }
    >
      <div className="space-y-3">
        {list.map((country, i) => (
          <ProgressRow
            key={country.code}
            label={getCountryName(country.code) || country.name || 'Unknown'}
            value={
              <>
                <span className="text-default-400 mr-1.5">{country.percent}%</span>
                {formatValue(country.value)}
              </>
            }
            percent={country.percent}
            colorClass={getProgressColorClass(i)}
          />
        ))}
      </div>
    </ChartCard>
  )
}

function getProgressColorClass(index: number): string {
  // Tailwind-static map to avoid dynamic class generation purging
  const map = [
    'bg-primary-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-default-400',
  ]
  return map[index] ?? map[map.length - 1]
}
