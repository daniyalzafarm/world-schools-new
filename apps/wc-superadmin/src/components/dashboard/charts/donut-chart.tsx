'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCompactNumber } from '@/hooks/use-currency-format'

interface DonutSlice {
  name: string
  value: number
  color: string
  /** Pre-formatted secondary metric (e.g. GMV) shown in the hover tooltip. */
  gmvLabel?: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  centerLabel?: string
  centerValue?: string | number
  height?: number
  formatValue?: (value: number) => string
}

function DonutTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean
  payload?: { payload?: DonutSlice }[]
  formatValue?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload
  if (!datum) return null
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-sm dark:bg-default-50">
      <div className="font-semibold text-foreground">{datum.name}</div>
      <div className="text-default-600">{formatValue ? formatValue(datum.value) : datum.value}</div>
      {datum.gmvLabel ? <div className="text-default-500">GMV: {datum.gmvLabel}</div> : null}
    </div>
  )
}

/**
 * Custom legend rendered directly from the `slices` array — name, value, and
 * color all come from the same object in a single iteration, so the percentage
 * can never be paired with the wrong label (BUG-125). Avoids recharts' auto
 * legend payload + name-matching indirection, which swapped percentages.
 */
function DonutLegend({ slices, total }: { slices: DonutSlice[]; total: number }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
      {slices.map(slice => {
        const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
        return (
          <li key={slice.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="text-default-700 dark:text-default-200">
              {slice.name} <span className="text-default-400">— {pct}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
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
            content={<DonutTooltip formatValue={formatValue} />}
            wrapperStyle={{ zIndex: 10 }}
          />
          <Legend
            content={<DonutLegend slices={slices} total={total} />}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
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
