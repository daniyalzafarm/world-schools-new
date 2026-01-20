'use client'

import { useState } from 'react'

interface ExpandableTextProps {
  text: string
  maxLines?: number
  className?: string
}

export function ExpandableText({ text, maxLines = 4, className = '' }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!text) return null

  return (
    <div className={className}>
      <div
        className={`text-[15px] text-[#222222] leading-relaxed mb-4 ${
          !isExpanded ? `line-clamp-${maxLines}` : ''
        }`}
        style={
          !isExpanded
            ? {
                display: '-webkit-box',
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}
        }
      >
        {text}
      </div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-[15px] font-semibold text-[#222222] underline pb-8 hover:opacity-70 transition-opacity"
      >
        {isExpanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  )
}
