'use client'

import type { ActivityWithCategory } from '../../utils/camp-focus-activities'

interface SingleSelectActivityGridProps {
  activities: ActivityWithCategory[]
  selectedActivityId: string | null
  onSelect: (activity: ActivityWithCategory) => void
}

export function SingleSelectActivityGrid({
  activities,
  selectedActivityId,
  onSelect,
}: SingleSelectActivityGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {activities.map(activity => {
        const isSelected = selectedActivityId === activity.id

        return (
          <button
            key={activity.id}
            type="button"
            onClick={() => onSelect(activity)}
            className={`
              flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
              ${
                isSelected
                  ? 'border-primary bg-primary-50 dark:bg-primary-50/10'
                  : 'border-default-200 bg-white hover:border-primary hover:bg-default-50 dark:bg-default-50 dark:hover:bg-default-100'
              }
              cursor-pointer
            `}
          >
            <span className="text-3xl">{activity.icon}</span>
            <span className="text-center text-sm font-medium text-default-900">
              {activity.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
