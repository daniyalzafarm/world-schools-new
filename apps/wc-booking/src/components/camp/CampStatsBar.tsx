import { cn } from '@world-schools/ui-web'

import type { AgeGroup, Camp } from '../../types/camps'

const GENDER_LABELS: Record<string, string> = {
  coed: 'Boys & Girls',
  boys: 'Boys',
  girls: 'Girls',
}

interface StatCell {
  label: string
  value: string
  icon: string
  /** Ages row uses secondary (navy) per module-01 */
  highlightValue?: boolean
}

interface CampStatsBarProps {
  gender: Camp['gender']
  ageGroups: AgeGroup[]
  primaryFocus?: { activityName: string } | null
  /** Emoji shown in the Focus stat label (module-01). */
  focusEmoji?: string | null
  campType: Camp['type']
  /** Shown in the Level cell when primaryFocus is set; defaults to "All levels" if omitted. */
  levelLabel?: string | null
  className?: string
}

export function CampStatsBar({
  gender,
  ageGroups,
  primaryFocus,
  focusEmoji = '📌',
  campType,
  levelLabel,
  className = '',
}: CampStatsBarProps) {
  const stats: StatCell[] = []

  if (gender) {
    stats.push({
      icon: '👥',
      label: 'Gender',
      value: GENDER_LABELS[gender] ?? gender,
    })
  }

  if (ageGroups?.length) {
    const minAge = Math.min(...ageGroups.map(g => g.min))
    const maxAge = Math.max(...ageGroups.map(g => g.max))
    stats.push({
      icon: '🎂',
      label: 'Ages',
      value: `${minAge}–${maxAge}`,
      highlightValue: true,
    })
  }

  if (primaryFocus?.activityName) {
    stats.push({
      icon: focusEmoji?.trim() || '📌',
      label: 'Focus',
      value: primaryFocus.activityName,
    })
    stats.push({
      icon: '📊',
      label: 'Level',
      value: levelLabel?.trim() ?? 'All levels',
    })
  } else if (campType) {
    stats.push({
      icon: '🏕️',
      label: 'Type',
      value: campType === 'residential' ? 'Residential' : 'Day camp',
    })
  }

  if (stats.length < 2) return null

  const mdCols =
    stats.length >= 4 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'

  return (
    <div
      className={`grid grid-cols-2 ${mdCols} gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${className}`}
    >
      {stats.map(stat => (
        <div key={`${stat.label}-${stat.value}`} className="flex flex-col gap-2 bg-white px-5 py-4">
          <span className="flex items-center gap-1 text-xs font-semibold tracking-[0.5px] text-gray-400 uppercase">
            <span className="text-[13px] leading-none" aria-hidden>
              {stat.icon}
            </span>
            {stat.label}
          </span>
          <span
            className={cn(
              'text-sm font-semibold md:text-base',
              stat.highlightValue ? 'text-secondary-700' : 'text-gray-900'
            )}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}
