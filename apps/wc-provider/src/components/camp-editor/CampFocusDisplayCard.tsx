'use client'

import { Button } from '@heroui/react'
import type { PrimaryFocus } from '../../types/camps'

interface CampFocusDisplayCardProps {
  primaryFocus: PrimaryFocus | null
  onRemove: () => void
}

export function CampFocusDisplayCard({ primaryFocus, onRemove }: CampFocusDisplayCardProps) {
  if (!primaryFocus) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-default-300 bg-default-50 p-8 text-center">
        <div className="text-5xl">🎯</div>
        <div className="text-lg font-semibold text-foreground">No Focus Selected</div>
        <div className="max-w-md text-sm text-default-500">
          Your camp doesn't currently have a specialized focus. Select an activity below if your
          camp specializes in a specific area.
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border-2 border-primary bg-primary-50/50 p-6 dark:bg-primary-50/10">
      <div className="flex-shrink-0 text-5xl">{primaryFocus.icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-default-500">Your camp appears as:</div>
        <div className="text-2xl font-bold text-foreground">{primaryFocus.activityName} Camp</div>
        <div className="text-sm text-default-600">From {primaryFocus.categoryName} program</div>
      </div>
      <Button color="danger" variant="flat" size="sm" onPress={onRemove} className="flex-shrink-0">
        Remove Focus
      </Button>
    </div>
  )
}
