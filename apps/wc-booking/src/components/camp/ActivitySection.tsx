'use client'

import type { ActivityItem, MetaCard } from '../../types/camps'
import { ExpandableText } from './ExpandableText'
import { ProgramMetaCards } from './ProgramMetaCards'
import { ProgramBadges } from './ProgramBadges'
import { ActivityGrid } from './ActivityGrid'

interface ActivitySectionProps {
  title: string
  icon?: string
  description?: string
  metaCards?: MetaCard[]
  badges?: string[]
  items?: ActivityItem[]
  totalCount?: number
  className?: string
}

export function ActivitySection({
  title,
  icon,
  description,
  metaCards,
  badges,
  items,
  totalCount,
  className = '',
}: ActivitySectionProps) {
  return (
    <div className={`pb-6 border-b border-gray-200 last:border-0 ${className}`}>
      {/* Section Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h3>

      {/* Description */}
      {description && <ExpandableText text={description} maxLines={4} className="mb-4" />}

      {/* Program Meta Cards */}
      {metaCards && metaCards.length > 0 && <ProgramMetaCards cards={metaCards} />}

      {/* Program Badges */}
      {badges && badges.length > 0 && <ProgramBadges badges={badges} />}

      {/* Activities Grid */}
      {items && items.length > 0 ? (
        <ActivityGrid activities={items} totalCount={totalCount} mobileCount={4} desktopCount={6} />
      ) : (
        <p className="text-sm text-gray-500">No specific activities listed.</p>
      )}
    </div>
  )
}
