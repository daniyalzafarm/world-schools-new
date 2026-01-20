'use client'

import { useState } from 'react'

interface Activity {
  icon: string
  name: string
}

interface ActivityGridProps {
  activities: Activity[]
  initialCount?: number
  mobileCount?: number
  desktopCount?: number
  className?: string
}

export function ActivityGrid({
  activities,
  initialCount,
  mobileCount = 4,
  desktopCount = 6,
  className = '',
}: ActivityGridProps) {
  const [showAll, setShowAll] = useState(false)

  if (!activities || activities.length === 0) return null

  const displayCount =
    initialCount ??
    (typeof window !== 'undefined' && window.innerWidth >= 768 ? desktopCount : mobileCount)
  const visibleActivities = showAll ? activities : activities.slice(0, displayCount)
  const hasMore = activities.length > displayCount

  return (
    <div className={className}>
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 ${showAll ? '' : ''}`}>
        {visibleActivities.map((activity, index) => (
          <div
            key={index}
            className="bg-[#F7F7F7] rounded-xl p-4 cursor-pointer transition-colors hover:bg-[#E8E9EB]"
          >
            <div className="text-[32px] mb-3">{activity.icon}</div>
            <div className="text-[16px] font-semibold text-[#222222] mb-1">{activity.name}</div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 px-4 mt-4 bg-white border border-[#222222] rounded-lg text-[15px] font-semibold hover:bg-[#F7F7F7] transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${activities.length} activities`}
        </button>
      )}
    </div>
  )
}
