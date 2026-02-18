/**
 * Message Skeleton Loader
 *
 * Displays a skeleton loading state for messages in the chat view
 */

import React from 'react'
import { Skeleton } from '@heroui/react'

interface MessageSkeletonProps {
  isUser?: boolean
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ isUser = false }) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar skeleton (only for non-user messages) */}
        {!isUser && <Skeleton className="flex-shrink-0 w-8 h-8 rounded-full" />}

        {/* Message bubble skeleton */}
        <div className="flex flex-col gap-1">
          <Skeleton className={`h-16 rounded-2xl ${isUser ? 'w-48' : 'w-64'}`} />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Multiple message skeletons
 */
export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <MessageSkeleton key={index} isUser={index % 2 === 0} />
      ))}
    </div>
  )
}
