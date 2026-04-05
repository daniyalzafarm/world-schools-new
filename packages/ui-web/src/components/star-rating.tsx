'use client'

import { Star } from 'lucide-react'
import { cn } from '../utils/cn'

export type StarRatingColor = 'default' | 'primary' | 'yellow'

const starColorMap: Record<StarRatingColor, string> = {
  default: 'text-primary-dark',
  primary: 'text-primary',
  yellow: 'text-amber-400',
}

export interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: number
  showRating?: boolean
  color?: StarRatingColor
  className?: string
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  showRating = true,
  color = 'default',
  className,
}: StarRatingProps) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 !== 0
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0)
  const filledClass = starColorMap[color]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, index) => (
          <Star key={`full-${index}`} size={size} className={cn(filledClass, 'fill-current')} />
        ))}

        {hasHalfStar && (
          <div className="relative">
            <Star size={size} className="text-gray-300" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <Star size={size} className={cn(filledClass, 'fill-current')} />
            </div>
          </div>
        )}

        {Array.from({ length: emptyStars }).map((_, index) => (
          <Star key={`empty-${index}`} size={size} className="text-gray-300" />
        ))}
      </div>

      {showRating && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
