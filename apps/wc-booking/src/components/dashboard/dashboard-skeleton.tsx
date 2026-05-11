'use client'

import { Skeleton } from '@heroui/react'
import { DashboardShell } from './dashboard-shell'

export function DashboardSkeleton() {
  return (
    <DashboardShell>
      <Skeleton className="mb-2 h-8 w-64 rounded-lg" />
      <Skeleton className="mb-8 h-4 w-80 rounded-lg" />
      <Skeleton className="mb-8 h-40 w-full rounded-3xl" />
      <Skeleton className="mb-3 h-5 w-40 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </DashboardShell>
  )
}
