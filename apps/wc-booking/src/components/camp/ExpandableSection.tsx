'use client'

import { useState } from 'react'

interface ExpandableSectionProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  className?: string
}

export function ExpandableSection({
  title,
  children,
  defaultExpanded = false,
  className = '',
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={`border-b border-[#DDDDDD] ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-4 text-left hover:opacity-70 transition-opacity"
      >
        <span className="text-[16px] font-semibold text-[#222222]">{title}</span>
        <span
          className="text-[20px] text-[#717171] transition-transform"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {isExpanded && (
        <div className="pb-6 text-[15px] text-[#717171] leading-relaxed">{children}</div>
      )}
    </div>
  )
}
