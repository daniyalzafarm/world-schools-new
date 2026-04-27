import { BarChart3, Target, Tent, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'

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
  icon: ReactNode
}

interface CampStatsBarProps {
  gender: Camp['gender']
  ageGroups: AgeGroup[]
  primaryFocus?: { activityName: string } | null
  campType: Camp['type']
  /** Shown in the Level cell when primaryFocus is set; defaults to "All levels" if omitted. */
  levelLabel?: string | null
  className?: string
}

const ICON_CLASS = 'h-4 w-4 shrink-0 text-primary-600'

export function CampStatsBar({
  gender,
  ageGroups,
  primaryFocus,
  campType,
  levelLabel,
  className = '',
}: CampStatsBarProps) {
  const stats: StatCell[] = []

  if (gender) {
    stats.push({
      icon: <Users className={ICON_CLASS} strokeWidth={1.6} aria-hidden />,
      label: 'Gender',
      value: GENDER_LABELS[gender] ?? gender,
    })
  }

  if (ageGroups?.length) {
    const minAge = Math.min(...ageGroups.map(g => g.min))
    const maxAge = Math.max(...ageGroups.map(g => g.max))
    stats.push({
      icon: <User className={ICON_CLASS} strokeWidth={1.6} aria-hidden />,
      label: 'Ages',
      value: `${minAge}–${maxAge}`,
    })
  }

  if (primaryFocus?.activityName) {
    stats.push({
      icon: <Target className={ICON_CLASS} strokeWidth={1.6} aria-hidden />,
      label: 'Focus',
      value: primaryFocus.activityName,
    })
    stats.push({
      icon: <BarChart3 className={ICON_CLASS} strokeWidth={1.6} aria-hidden />,
      label: 'Level',
      value: levelLabel?.trim() ?? 'All levels',
    })
  } else if (campType) {
    stats.push({
      icon: <Tent className={ICON_CLASS} strokeWidth={1.6} aria-hidden />,
      label: 'Type',
      value: campType === 'residential' ? 'Residential' : 'Day camp',
    })
  }

  if (stats.length < 2) return null

  const mdCols =
    stats.length >= 4 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-100',
        mdCols,
        className
      )}
    >
      {stats.map(stat => (
        <div key={`${stat.label}-${stat.value}`} className="flex flex-col gap-2 bg-white px-5 py-4">
          <span className="text-xs font-semibold tracking-[0.5px] text-gray-400 uppercase">
            {stat.label}
          </span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 md:text-base">
            {stat.icon}
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}
