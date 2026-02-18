'use client'

import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../utils/cn'

export interface ShowMoreButtonProps {
  isExpanded: boolean
  onToggle: () => void
  showText?: string
  hideText?: string
  className?: string
}

export const ShowMoreButton: React.FC<ShowMoreButtonProps> = ({
  isExpanded,
  onToggle,
  showText = 'Show more',
  hideText = 'Show less',
  className,
}) => {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'mt-2 flex items-center gap-1 font-semibold underline text-sm cursor-pointer transition-colors',
        className
      )}
    >
      <span>{isExpanded ? hideText : showText}</span>
      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </div>
  )
}
