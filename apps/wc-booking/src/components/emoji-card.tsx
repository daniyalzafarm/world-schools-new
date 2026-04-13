'use client'

import React from 'react'

interface EmojiCardProps {
  emoji: string
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

/**
 * EmojiCard component for displaying selectable emoji-based cards
 * Matches the .card-item pattern from the reference design
 */
export function EmojiCard({ emoji, label, selected, onClick, disabled = false }: EmojiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
        ${
          selected
            ? 'border-primary bg-primary-50 dark:bg-primary-50/10'
            : 'border-default-200 bg-white hover:border-primary hover:bg-default-50 dark:bg-default-50 dark:hover:bg-default-100'
        }
        ${
          !disabled
            ? 'cursor-pointer hover:border-primary dark:hover:border-primary-400 hover:-tranprimary-y-0.5'
            : 'cursor-not-allowed opacity-50'
        }
      `}
    >
      <span className="text-3xl leading-none">{emoji}</span>
      <span className={`text-sm font-medium`}>{label}</span>
    </button>
  )
}
