'use client'

import type { ActivityItem, MetaCard } from '../../types/camps'
import { ExpandableText } from './ExpandableText'
import { ProgramMetaCards } from './ProgramMetaCards'
import { ProgramBadges } from './ProgramBadges'
import { ActivityGrid } from './ActivityGrid'
import { ExcursionCardGrid } from './ExcursionCardGrid'

interface ActivitySectionProps {
  title: string
  icon?: string
  description?: string
  metaCards?: MetaCard[]
  badges?: string[]
  items?: ActivityItem[]
  totalCount?: number
  compact?: boolean
  expandAll?: boolean
  className?: string
}

export function ActivitySection({
  title,
  description,
  metaCards,
  badges,
  items,
  totalCount,
  compact = false,
  expandAll = false,
  className = '',
}: ActivitySectionProps) {
  return (
    <div className={`py-6 border-b border-gray-200 last:border-0 first:pt-0 ${className}`}>
      {/* Section Title */}
      <h3 className={`font-bold text-gray-900 mb-3 ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </h3>

      {/* Description */}
      {description &&
        (expandAll ? (
          <p className="mb-3 text-base text-gray-700">{description}</p>
        ) : (
          <ExpandableText text={description} maxLines={compact ? 2 : 4} className="mb-3" />
        ))}

      {/* Program Meta Cards — only on non-compact */}
      {!compact && metaCards && metaCards.length > 0 && <ProgramMetaCards cards={metaCards} />}

      {/* Program Badges — only on non-compact */}
      {!compact && badges && badges.length > 0 && <ProgramBadges badges={badges} />}

      {/* Activities — excursion cards when photos present, grid otherwise */}
      {items &&
        items.length > 0 &&
        (items.some(i => i.photoUrl) ? (
          <ExcursionCardGrid items={items} showCaptions />
        ) : (
          <ActivityGrid
            activities={items}
            totalCount={totalCount}
            compact={compact}
            pill={expandAll}
            mobileCount={expandAll ? 999 : compact ? 6 : 4}
            desktopCount={expandAll ? 999 : compact ? 9 : 8}
          />
        ))}
    </div>
  )
}
