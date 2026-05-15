'use client'

import type { ChecklistItemViewModel } from '@/types/provider-dashboard'
import { Section } from './section'
import { ChecklistItem } from './checklist-item'

interface ChecklistProps {
  title: string
  items: ChecklistItemViewModel[]
  showProgress?: boolean
  linkHref?: string
  linkLabel?: string
}

export function Checklist({
  title,
  items,
  showProgress = true,
  linkHref,
  linkLabel,
}: ChecklistProps) {
  const doneCount = items.filter(i => i.done).length
  const heading = showProgress ? `${title} (${doneCount}/${items.length})` : title

  return (
    <Section title={heading} linkHref={linkHref} linkLabel={linkLabel}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <ChecklistItem key={item.id} item={item} />
        ))}
      </div>
    </Section>
  )
}
