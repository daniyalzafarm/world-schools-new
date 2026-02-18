/**
 * Conversation Skeleton Loader
 *
 * Displays a skeleton loading state for conversation items in the sidebar
 */

import React from 'react'
import { Skeleton } from '@heroui/react'

export const ConversationSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      {/* Avatar skeleton */}
      <Skeleton className="flex-shrink-0 w-12 h-12 rounded-full" />

      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          {/* Name skeleton */}
          <Skeleton className="h-4 w-32 rounded" />
          {/* Time skeleton */}
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        {/* Last message skeleton */}
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  )
}

/**
 * Multiple conversation skeletons
 */
export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ConversationSkeleton key={index} />
      ))}
    </>
  )
}
