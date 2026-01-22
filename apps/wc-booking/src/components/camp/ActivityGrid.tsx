'use client'

import { useEffect, useState } from 'react'
import type { ActivityItem } from '../../types/camps'

interface ActivityGridProps {
  activities: ActivityItem[]
  mobileCount?: number
  desktopCount?: number
  totalCount?: number
  className?: string
}

export function ActivityGrid({
  activities,
  mobileCount = 4,
  desktopCount = 6,
  totalCount,
  className = '',
}: ActivityGridProps) {
  const [showAll, setShowAll] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {visibleActivities.map(activity => (
          <div
            key={activity.id}
            className="bg-gray-100 rounded-xl p-4 transition-colors hover:bg-gray-200"
          >
            <div className="text-3xl mb-3">{activity.icon}</div>
            <div className="text-base font-semibold text-gray-900">{activity.name}</div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 px-4 bg-white border border-gray-900 rounded-lg text-base font-semibold hover:bg-gray-50 transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${total} activities`}
        </button>
      )}
    </div>
  )
}
