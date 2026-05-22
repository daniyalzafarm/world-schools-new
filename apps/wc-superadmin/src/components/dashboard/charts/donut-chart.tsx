'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCompactNumber } from '@/hooks/use-currency-format'

interface DonutSlice {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  centerLabel?: string
  centerValue?: string | number
  height?: number
  formatValue?: (value: number) => string
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  height = 280,
  formatValue,
}: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0)

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            isAnimationActive={false}
          >
            {slices.map((slice, i) => (
              <Cell key={i} fill={slice.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
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
            formatter={(value, _entry, index) => {
              const slice = slices[index]
              const pct = total > 0 ? Math.round(((slice?.value ?? 0) / total) * 100) : 0
              return (
                <span className="text-default-700 dark:text-default-200">
                  {value} <span className="text-default-400">— {pct}%</span>
                </span>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue !== undefined) && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ paddingBottom: 40 }}
        >
          {centerValue !== undefined && (
            <div className="text-2xl font-bold text-foreground">
              {typeof centerValue === 'number' ? formatCompactNumber(centerValue) : centerValue}
            </div>
          )}
          {centerLabel && <div className="text-xs text-default-500">{centerLabel}</div>}
        </div>
      )}
    </div>
  )
}
