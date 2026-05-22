'use client'

import { Card, CardBody, Skeleton } from '@heroui/react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '@/lib/chart-theme'

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  iconBgClass?: string
  iconColorClass?: string
  trendPct?: number
  invertTrendColor?: boolean
  sparkline?: number[]
  sparklineColor?: string
  loading?: boolean
  footer?: ReactNode
}

export function KpiCard({
  label,
  value,
  icon,
  iconBgClass = 'bg-primary-50 dark:bg-primary-900/30',
  iconColorClass = 'text-primary-600 dark:text-primary-300',
  trendPct,
  invertTrendColor = false,
  sparkline,
  sparklineColor = CHART_COLORS.primary,
  loading = false,
  footer,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card shadow="sm" className="border border-default-200">
        <CardBody className="space-y-3 p-5">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </CardBody>
      </Card>
    )
  }

  const positiveDirection = invertTrendColor ? (trendPct ?? 0) < 0 : (trendPct ?? 0) > 0
  const trendColorClass =
    trendPct === undefined || trendPct === 0
      ? 'text-default-500 bg-default-100 dark:bg-default-800'
      : positiveDirection
        ? 'text-success-700 bg-success-50 dark:text-success-300 dark:bg-success-900/30'
        : 'text-danger-700 bg-danger-50 dark:text-danger-300 dark:bg-danger-900/30'

  return (
    <Card shadow="sm" className="border border-default-200">
      <CardBody className="@container space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgClass}`}>
            <span className={iconColorClass}>{icon}</span>
          </div>
          {trendPct !== undefined && (
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trendColorClass}`}
            >
              {trendPct === 0 ? (
                <Minus className="h-3 w-3" />
              ) : trendPct > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trendPct)}%
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div
            // Container-query responsive sizing: text scales based on the card's
            // actual width, not the viewport's. At xl:grid-cols-5 each card
            // is ~260px so we need the smaller size; on mobile (1 col, full
            // width) we can afford the largest. `whitespace-nowrap` + `truncate`
            // means a freakishly long value gets clipped with ellipsis instead
            // of wrapping to a second line and breaking the card layout.
            className="truncate text-xl font-bold tracking-tight text-foreground @[14rem]:text-2xl @[20rem]:text-3xl"
            title={value}
          >
            {value}
          </div>
          <div className="mt-0.5 text-sm text-default-500">{label}</div>
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="-mx-1 min-w-0">
            <ResponsiveContainer width="100%" height={40} minWidth={0}>
              <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparklineColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {footer}
      </CardBody>
    </Card>
  )
}
