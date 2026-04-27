'use client'

import { getStatus, type SectionProgress } from './editor-sections'

export function CountBadge({ progress }: { progress: SectionProgress }) {
  const status = getStatus(progress)
  const label =
    progress.total === 1
      ? progress.completed === 0
        ? 'Add'
        : 'Done'
      : `${progress.completed}/${progress.total}`

  const colorClasses =
    status === 'complete'
      ? 'bg-success-100 text-success-700'
      : status === 'partial'
        ? 'bg-warning-100 text-warning-800'
        : 'bg-danger-100 text-danger-700'

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorClasses}`}
    >
      {label}
    </span>
  )
}
