'use client'

import type { MetaCard } from '../../types/camps'

interface ProgramMetaCardsProps {
  cards: MetaCard[]
  className?: string
}

export function ProgramMetaCards({ cards, className = '' }: ProgramMetaCardsProps) {
  if (!cards || cards.length === 0) return null

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 ${className}`}>
      {cards.map((card, index) => (
        <div key={index} className="bg-gray-100 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{card.label}</div>
          <div className="text-base font-semibold text-gray-900">{card.value}</div>
        </div>
      ))}
    </div>
  )
}
