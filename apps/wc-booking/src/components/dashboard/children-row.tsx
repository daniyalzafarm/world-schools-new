'use client'

import type { Child } from '@/types/child'
import { ChildChip } from './child-chip'
import { AddChildButton } from './add-child-button'

interface ChildrenRowProps {
  children: Child[]
  selectedId?: string
  onSelect?: (childId: string) => void
}

export function ChildrenRow({ children, selectedId, onSelect }: ChildrenRowProps) {
  if (children.length === 0) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {children.map(child => (
        <ChildChip
          key={child.id}
          child={child}
          selected={selectedId === child.id}
          onPress={onSelect}
        />
      ))}
      <AddChildButton />
    </div>
  )
}
