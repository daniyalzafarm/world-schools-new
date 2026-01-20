'use client'

interface ProgramBadgesProps {
  badges: string[]
  className?: string
}

export function ProgramBadges({ badges, className = '' }: ProgramBadgesProps) {
  if (!badges || badges.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 mb-4 ${className}`}>
      {badges.map((badge, index) => (
        <span key={index} className="bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-900">
          {badge}
        </span>
      ))}
    </div>
  )
}
