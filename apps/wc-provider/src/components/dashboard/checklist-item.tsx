'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import type { ChecklistItemViewModel } from '@/types/provider-dashboard'

interface ChecklistItemProps {
  item: ChecklistItemViewModel
}

export function ChecklistItem({ item }: ChecklistItemProps) {
  const className = cn(
    'flex items-center gap-3 rounded-xl border border-default-200 bg-background p-3 transition-colors',
    item.actionHref && !item.done && 'hover:border-foreground'
  )

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          item.done
            ? 'border-primary-500 bg-primary-500 text-secondary-500'
            : 'border-default-300 bg-background'
        )}
      >
        {item.done && <Check size={14} strokeWidth={3} />}
      </span>
      <span
        className={cn(
          'text-sm',
          item.done ? 'text-default-500 line-through' : 'font-medium text-foreground'
        )}
      >
        {item.label}
      </span>
    </>
  )

  if (item.actionHref && !item.done) {
    return (
      <Link href={item.actionHref} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}
