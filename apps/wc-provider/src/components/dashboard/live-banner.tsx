'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { MessageCircle } from 'lucide-react'
import { daysSince, daysUntil } from '@/utils/provider-dashboard'
import type { Session } from '@/types/sessions'

interface LiveBannerProps {
  session: Session
  campName?: string
}

export function LiveBanner({ session, campName }: LiveBannerProps) {
  const sinceStart = daysSince(session.startDate) ?? 0
  const totalDuration = (daysUntil(session.endDate) ?? 0) + sinceStart + 1
  const currentDay = Math.max(1, sinceStart + 1)
  const totalDays = Math.max(currentDay, totalDuration)

  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-success-500 to-success-700 p-6 text-white sm:p-10">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live
      </div>
      <h2 className="mb-1 text-2xl font-bold sm:text-3xl">
        {campName ? `${campName} — ${session.name}` : session.name}
      </h2>
      <p className="mb-6 text-sm text-white/80 sm:text-base">
        Day {currentDay} of {totalDays}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button as={Link} href="/bookings" color="default" radius="lg">
          View attendees
        </Button>
        <Button
          as={Link}
          href="/messages"
          variant="bordered"
          radius="lg"
          className="border-white/40 text-white hover:bg-white/10"
          startContent={<MessageCircle size={18} />}
        >
          Message parents
        </Button>
      </div>
    </div>
  )
}
