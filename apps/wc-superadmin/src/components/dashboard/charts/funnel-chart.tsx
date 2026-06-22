'use client'

import { ArrowDown } from 'lucide-react'
import { SLICE_COLORS } from '@/lib/chart-theme'
import { pluralize } from '@/lib/format'
import { formatCompactNumber } from '@/hooks/use-currency-format'

interface FunnelStep {
  key: string
  label: string
  count: number
  dropoffPctFromPrev: number
  conversionPctFromTop: number
  lostFromPrev: number
  lostBreakdown: { reason: string; label: string; count: number }[]
}

interface FunnelChartProps {
  steps: FunnelStep[]
}

const STEP_HEIGHT_PX = 64
const FUNNEL_TOP_PCT = 100
const FUNNEL_BOTTOM_PCT = 30
const GHOST_OPACITY = 0.18
// Corner radii in viewBox units. x and y use different values because the SVG
// uses preserveAspectRatio="none" — viewBox y of 100 maps to STEP_HEIGHT_PX (64).
// These values give roughly circular corners (~8–9px) at typical render widths.
const CORNER_RX = 2
const CORNER_RY = 14

function buildTrapezoidPath(
  xTopLeft: number,
  xTopRight: number,
  xBotLeft: number,
  xBotRight: number,
  yTop: number,
  yBot: number,
  roundTop: boolean,
  roundBottom: boolean
): string {
  const topRx = roundTop ? Math.min(CORNER_RX, (xTopRight - xTopLeft) / 2) : 0
  const botRx = roundBottom ? Math.min(CORNER_RX, (xBotRight - xBotLeft) / 2) : 0
  const ry = CORNER_RY

  const parts: string[] = []
  parts.push(`M ${xTopLeft + topRx} ${yTop}`)
  parts.push(`L ${xTopRight - topRx} ${yTop}`)
  if (roundTop) parts.push(`A ${topRx} ${ry} 0 0 1 ${xTopRight} ${yTop + ry}`)
  parts.push(`L ${xBotRight} ${roundBottom ? yBot - ry : yBot}`)
  if (roundBottom) parts.push(`A ${botRx} ${ry} 0 0 1 ${xBotRight - botRx} ${yBot}`)
  parts.push(`L ${xBotLeft + botRx} ${yBot}`)
  if (roundBottom) parts.push(`A ${botRx} ${ry} 0 0 1 ${xBotLeft} ${yBot - ry}`)
  parts.push(`L ${xTopLeft} ${roundTop ? yTop + ry : yTop}`)
  if (roundTop) parts.push(`A ${topRx} ${ry} 0 0 1 ${xTopLeft + topRx} ${yTop}`)
  parts.push('Z')
  return parts.join(' ')
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (steps.length === 0) {
    return <div className="text-sm text-default-500">No funnel data.</div>
  }

  const n = steps.length
  const isEmpty = steps.every(s => s.count === 0)

  const widths = steps.map((_, i) =>
    n === 1 ? FUNNEL_TOP_PCT : FUNNEL_TOP_PCT - (i / (n - 1)) * (FUNNEL_TOP_PCT - FUNNEL_BOTTOM_PCT)
  )

  const svgHeight = n * STEP_HEIGHT_PX
  const viewBoxHeight = n * 100

  return (
    <div className="mx-auto flex max-w-220 flex-col gap-4 sm:flex-row sm:gap-6">
      <div className="relative w-full sm:w-120 sm:shrink-0">
        <svg
          role="img"
          aria-label={
            isEmpty
              ? 'Conversion funnel with no data for this period'
              : `Conversion funnel from ${steps[0].label} to ${steps[n - 1].label}`
          }
          viewBox={`0 0 100 ${viewBoxHeight}`}
          preserveAspectRatio="none"
          width="100%"
          height={svgHeight}
          className="block"
        >
          {steps.map((step, i) => {
            const topW = widths[i]
            const bottomW = i < n - 1 ? widths[i + 1] : topW
            const yTop = i * 100
            const yBot = (i + 1) * 100
            const xTopLeft = (100 - topW) / 2
            const xTopRight = (100 + topW) / 2
            const xBotLeft = (100 - bottomW) / 2
            const xBotRight = (100 + bottomW) / 2
            const color = SLICE_COLORS[i % SLICE_COLORS.length]
            const d = buildTrapezoidPath(
              xTopLeft,
              xTopRight,
              xBotLeft,
              xBotRight,
              yTop,
              yBot,
              i === 0,
              i === n - 1
            )
            return (
              <path
                key={step.key}
                d={d}
                fill={color}
                fillOpacity={isEmpty ? GHOST_OPACITY : 1}
                className={isEmpty ? '' : 'transition-opacity hover:opacity-80'}
                aria-label={`${step.label}: ${step.count}`}
              >
                {!isEmpty && (
                  <title>{`${step.label}: ${formatCompactNumber(step.count)} (${step.conversionPctFromTop}% of top)`}</title>
                )}
              </path>
            )
          })}
        </svg>
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium text-default-600 shadow-sm dark:text-default-400">
              No data for this period
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className="flex flex-col justify-center"
            style={{ height: STEP_HEIGHT_PX }}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <div
                className={
                  isEmpty ? 'font-semibold text-default-400' : 'font-semibold text-foreground'
                }
              >
                {step.label}
              </div>
              <div className="flex items-center gap-3 text-xs">
                {isEmpty ? (
                  <>
                    <span className="text-default-400">—</span>
                    <span className="text-default-400">—</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-foreground">
                      {formatCompactNumber(step.count)}
                    </span>
                    <span className="text-default-500">{step.conversionPctFromTop}% of top</span>
                  </>
                )}
              </div>
            </div>
            {!isEmpty && i > 0 && step.lostFromPrev > 0 && (
              <div className="mt-1 text-xs">
                <div className="flex items-center gap-1 text-danger-600 dark:text-danger-400">
                  <ArrowDown className="h-3 w-3 shrink-0" />
                  <span>
                    {formatCompactNumber(step.lostFromPrev)}{' '}
                    {pluralize(step.lostFromPrev, 'booking')} lost ({step.dropoffPctFromPrev}% of
                    previous)
                  </span>
                </div>
                {step.lostBreakdown.length > 0 && (
                  <div className="mt-0.5 pl-4 text-default-500">
                    {step.lostBreakdown
                      .map(b => `${formatCompactNumber(b.count)} ${b.label}`)
                      .join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
