import type { ReactNode } from 'react'
import { cn, PageSlot as SharedPageSlot } from '@world-schools/ui-web'

interface PageSlotProps {
  children: ReactNode
  className?: string
}

export function PageSlot({ children, className }: PageSlotProps) {
  return (
    <SharedPageSlot className={cn('max-w-400 space-y-6', className)}>{children}</SharedPageSlot>
  )
}
