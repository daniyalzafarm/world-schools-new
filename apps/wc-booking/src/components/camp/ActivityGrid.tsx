'use client'

import { useEffect, useState } from 'react'
import type { ActivityItem } from '../../types/camps'

interface ActivityGridProps {
  activities: ActivityItem[]
  mobileCount?: number
  desktopCount?: number
  totalCount?: number
  compact?: boolean
  pill?: boolean
  className?: string
}

export function ActivityGrid({
  activities,
  mobileCount = 6,
  desktopCount = 8,
  totalCount,
  compact = false,
  pill = false,
  className = '',
}: ActivityGridProps) {
  const [showAll, setShowAll] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!activities || activities.length === 0) return null

  const displayLimit = isMobile ? mobileCount : desktopCount
  const visibleActivities = showAll ? activities : activities.slice(0, displayLimit)
  const hasMore = activities.length > displayLimit
  const total = totalCount ?? activities.length

  return (
    <div className={className}>
      {pill ? (
        /* ── Pill style ── */
        <div className="flex flex-wrap gap-2">
          {visibleActivities.map(activity => (
            <span
              key={activity.id}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-[13.5px] font-semibold text-gray-900 whitespace-nowrap"
            >
              {activity.icon && activity.icon !== '✨' && (
                <span className="text-base leading-none" aria-hidden="true">
                  {activity.icon}
                </span>
              )}
              {activity.name}
            </span>
          ))}
        </div>
      ) : compact ? (
        /* ── Compact grid: emoji + label, tight cards ── */
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
          {visibleActivities.map(activity => (
            <div key={activity.id} className="flex items-center gap-2.5 py-1.5">
              {activity.icon && activity.icon !== '✨' && (
                <span className="text-base leading-none shrink-0 text-gray-500">
                  {activity.icon}
                </span>
              )}
              <span className="text-[13.5px] text-gray-800 leading-tight">{activity.name}</span>
            </div>
          ))}
        </div>
      ) : (
        /* ── Regular grid: bigger cards ── */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {visibleActivities.map(activity => (
            <div
              key={activity.id}
              className="bg-gray-50 border border-gray-100 rounded-xl p-3 transition-colors hover:bg-gray-100"
            >
              {activity.icon && activity.icon !== '✨' && (
                <div className="text-2xl mb-2">{activity.icon}</div>
              )}
              <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                {activity.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !pill && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 mt-1 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-semibold text-gray-600 bg-white hover:border-gray-400 hover:text-gray-900 transition-all"
        >
          {showAll ? 'Show less' : `Show all ${total} activities`}
        </button>
      )}
    </div>
  )
}
