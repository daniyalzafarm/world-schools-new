'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactNumber } from '@/hooks/use-currency-format'

interface Series {
  key: string
  name: string
  color: string
}

interface StackedBarChartProps {
  data: Record<string, number | string>[]
  xKey: string
  series: Series[]
  height?: number
  formatValue?: (value: number) => string
  formatXTick?: (value: string) => string
  stackId?: string
}

/**
 * Custom legend rendered directly from the `series` array so the color dot and
 * label stay vertically aligned, matching the donut chart legend.
 */
function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
      {series.map(s => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: s.color }}
          />
          <span className="text-default-700 dark:text-default-200">{s.name}</span>
        </li>
      ))}
    </ul>
  )
}

export function StackedBarChart({
  data,
  xKey,
  series,
  height = 280,
  formatValue,
  formatXTick,
  stackId = 'stack',
}: StackedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 6%)" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatXTick}
          tick={{ fontSize: 12, fill: 'currentColor' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={v => formatCompactNumber(Number(v))}
          tick={{ fontSize: 12, fill: 'currentColor' }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(value: any) => (formatValue ? formatValue(Number(value)) : value)}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.08)',
            background: 'var(--background, white)',
            fontSize: 12,
          }}
        />
        <Legend
          content={<SeriesLegend series={series} />}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        {series.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stackId}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
