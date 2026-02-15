'use client'

import { TrendingUp } from 'lucide-react'

interface TrustScoreBoostProps {
  points: number
  description: string
  isEarned?: boolean
  className?: string
}

export function TrustScoreBoost({
  points,
  description,
  isEarned = false,
  className = '',
}: TrustScoreBoostProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border-2 p-4 ${
        isEarned ? 'border-success-200 bg-success-50' : 'border-primary-200 bg-primary-50'
      } ${className}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isEarned ? 'bg-success text-white' : 'bg-primary text-white'
        }`}
      >
        <TrendingUp className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-bold ${isEarned ? 'text-success' : 'text-primary'}`}>
            {isEarned ? '✓' : '+'}
            {points} points
          </span>
          {isEarned && <span className="text-xs font-medium text-success">Earned</span>}
        </div>
        <p className="mt-1 text-sm text-default-600">{description}</p>
      </div>
    </div>
  )
}
