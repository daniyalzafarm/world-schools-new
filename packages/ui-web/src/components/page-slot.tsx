/**
 * Page Slot Component
 *
 * A simple layout utility that provides consistent page padding.
 * Ensures uniform spacing across all pages in the application.
 *
 * @example
 * ```typescript
 * import { PageSlot } from '@world-schools/ui-web'
 *
 * function MyPage() {
 *   return (
 *     <PageSlot>
 *       <h1>Page Content</h1>
 *       <p>This content will have consistent padding.</p>
 *     </PageSlot>
 *   )
 * }
 * ```
 */

import React from 'react'
import { cn } from '../utils/cn'

interface PageSlotProps {
  children: React.ReactNode
  className?: string
}

export function PageSlot({ children, className }: PageSlotProps) {
  return <div className={cn('mx-auto max-w-7xl p-6 lg:p-8', className)}>{children}</div>
}
