'use client'

interface ChartSkeletonProps {
  height?: number
  bars?: number
}

export function ChartSkeleton({ height = 240, bars = 8 }: ChartSkeletonProps) {
  const heights = Array.from({ length: bars }, (_, i) => 30 + ((i * 13) % 60))
  return (
    <div
      className="flex w-full items-end justify-between gap-2 rounded-xl bg-default-50 p-4"
      style={{ height }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-md bg-default-200/80 dark:bg-default-700/40"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}
