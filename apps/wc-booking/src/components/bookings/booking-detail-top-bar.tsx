'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'
import { statusBadgeClass, statusLabel } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupStatus } from '@/types/camp-booking'

export function BookingDetailTopBar({
  title,
  status,
}: {
  title: string
  status: ParentBookingGroupStatus
}) {
  return (
    <header className="z-10 shrink-0 border-b border-default-200 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <Button
          as={Link}
          href="/bookings"
          variant="light"
          size="sm"
          isIconOnly
          radius="sm"
          aria-label="Back to bookings"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-secondary">{title}</h1>
        </div>
        <span
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>
    </header>
  )
}
