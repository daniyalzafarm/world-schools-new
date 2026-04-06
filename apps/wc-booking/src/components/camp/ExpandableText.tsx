'use client'

import { useEffect, useRef, useState } from 'react'

interface ExpandableTextProps {
  text: string
  maxLines?: number
  className?: string
}

export function ExpandableText({ text, maxLines = 4, className = '' }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight)
    }
  }, [text, maxLines])

  if (!text) return null

  return (
    <div className={className}>
      <div
        ref={textRef}
        className={`text-base text-gray-900 leading-relaxed mb-4 ${
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
      {(isClamped || isExpanded) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer text-base font-semibold text-gray-900 underline pb-8 hover:opacity-70 transition-opacity"
        >
          {isExpanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
