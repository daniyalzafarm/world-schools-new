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
    <div className={`border-b border-gray-300 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-4 text-left hover:opacity-70 transition-opacity"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        <span
          className="text-xl text-gray-500 transition-transform"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {isExpanded && <div className="pb-6 text-base text-gray-500 leading-relaxed">{children}</div>}
    </div>
  )
}
