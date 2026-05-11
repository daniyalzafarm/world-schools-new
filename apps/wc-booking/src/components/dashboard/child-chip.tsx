'use client'

import { cn } from '@world-schools/ui-web'
import { Avatar } from '@heroui/react'
import { type Child, getChildAge, getChildDisplayName } from '@/types/child'

interface ChildChipProps {
  child: Child
  selected?: boolean
  onPress?: (childId: string) => void
}

export function ChildChip({ child, selected = false, onPress }: ChildChipProps) {
  const age = getChildAge(child)
  const initials =
    (child.firstName?.[0] ?? '').toUpperCase() + (child.lastName?.[0] ?? '').toUpperCase()
  const Tag = onPress ? 'button' : 'div'

  return (
    <Tag
      type={onPress ? 'button' : undefined}
      onClick={onPress ? () => onPress(child.id) : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-foreground bg-default-50'
          : 'border-default-200 bg-background hover:border-foreground'
      )}
    >
      <Avatar
        src={child.photoUrl ?? undefined}
        name={initials || child.firstName?.[0]}
        size="sm"
        className="bg-gradient-to-br from-primary-50 to-default-100 text-foreground"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-foreground">{getChildDisplayName(child)}</span>
        {age != null && <span className="text-xs text-default-500">{age} years old</span>}
      </span>
    </Tag>
  )
}
