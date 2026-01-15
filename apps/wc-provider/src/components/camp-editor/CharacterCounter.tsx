'use client'

interface CharacterCounterProps {
  current: number
  max: number
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  const percentage = (current / max) * 100
  const isNearLimit = percentage >= 90
  const isOverLimit = current > max

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`font-medium ${
          isOverLimit ? 'text-danger-600' : isNearLimit ? 'text-warning-600' : 'text-default-500'
        }`}
      >
        {current}
      </span>
      <span className="text-default-400">/</span>
      <span className="text-default-500">{max}</span>
    </div>
  )
}
