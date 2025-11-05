'use client';

import { Star } from 'lucide-react';
import { cn } from '../utils/cn';

export interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  showRating?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  showRating = true,
  className,
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, index) => (
          <Star
            key={`full-${index}`}
            size={size}
            className="text-primary-dark fill-current"
          />
        ))}

        {hasHalfStar && (
          <div className="relative">
            <Star size={size} className="text-gray-300" />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: '50%' }}
            >
              <Star size={size} className="text-primary-dark fill-current" />
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
  );
}
