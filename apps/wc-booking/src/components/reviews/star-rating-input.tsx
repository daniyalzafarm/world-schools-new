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

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  size?: 'sm' | 'lg'
  disabled?: boolean
  className?: string
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 'lg',
  disabled = false,
  className,
}) => {
  const [hoverRating, setHoverRating] = useState(0)

  const starSize = size === 'lg' ? 40 : 22
  const activeRating = hoverRating || value

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(star)}
            onMouseEnter={() => !disabled && setHoverRating(star)}
            onMouseLeave={() => !disabled && setHoverRating(0)}
            className={cn(
              'transition-transform duration-100 focus:outline-none',
              !disabled && 'cursor-pointer hover:scale-110 active:scale-95'
            )}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              size={starSize}
              className={cn(
                'transition-colors duration-100',
                star <= activeRating
                  ? 'text-primary fill-current'
                  : 'text-slate-300 dark:text-slate-600'
              )}
            />
          </button>
        ))}
      </div>

      {size === 'lg' && (
        <span
          className={cn(
            'text-sm font-medium transition-colors duration-100 min-h-5',
            activeRating > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-transparent'
          )}
        >
          {RATING_LABELS[activeRating] ?? ''}
        </span>
      )}
    </div>
  )
}
