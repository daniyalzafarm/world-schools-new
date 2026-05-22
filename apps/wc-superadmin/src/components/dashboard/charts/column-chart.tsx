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

interface ColumnSeries {
  key: string
  name: string
  color: string
}

interface ColumnChartProps {
  data: Record<string, number | string>[]
  xKey: string
  series: ColumnSeries[]
  height?: number
  formatValue?: (value: number) => string
  formatXTick?: (value: string) => string
}

export function ColumnChart({
  data,
  xKey,
  series,
  height = 280,
  formatValue,
  formatXTick,
}: ColumnChartProps) {
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
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={value => (
            <span className="text-default-700 dark:text-default-200">{value}</span>
          )}
        />
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
