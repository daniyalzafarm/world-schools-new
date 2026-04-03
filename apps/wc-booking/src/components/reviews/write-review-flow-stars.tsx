'use client'

import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@world-schools/ui-web'

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
}

export function WriteReviewFlowBigStars({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer p-0 leading-none transition-transform duration-100 hover:scale-110 focus:outline-none"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                'size-12 stroke-1 transition-colors md:size-16',
                n <= active
                  ? 'fill-primary-500 stroke-primary-500 text-primary-500'
                  : 'fill-transparent stroke-default-300 text-default-300 dark:stroke-slate-500 dark:text-slate-500'
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      <p className="mb-7 min-h-7 text-lg font-semibold text-default-900 dark:text-white">
        {active > 0 ? RATING_LABELS[active] : '\u00a0'}
      </p>
    </div>
  )
}

export function WriteReviewFlowCompactStars({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer p-0 leading-none transition-transform duration-100 hover:scale-110 focus:outline-none"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                'size-9 transition-colors md:size-11',
                n <= active
                  ? 'fill-primary-500 stroke-primary-500 text-primary-500'
                  : 'fill-transparent stroke-default-300 text-default-300 dark:stroke-slate-500 dark:text-slate-500'
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      <p className="mt-1 min-h-4 text-xs text-default-500 dark:text-slate-400">
        {active > 0 ? RATING_LABELS[active] : '\u00a0'}
      </p>
    </div>
  )
}
