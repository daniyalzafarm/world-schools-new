'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { MessageCircle } from 'lucide-react'
import { daysUntil } from '@/utils/provider-dashboard'
import type { Session } from '@/types/sessions'

interface CountdownBannerProps {
  session: Session
  campName?: string
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const sMonth = s.toLocaleString('en', { month: 'short' })
    const eMonth = e.toLocaleString('en', { month: 'short' })
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    if (sameMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`
  } catch {
    return ''
  }
}

export function CountdownBanner({ session, campName }: CountdownBannerProps) {
  const days = daysUntil(session.startDate) ?? 0
  const label = days <= 0 ? 'Starting today' : `Starts in ${days} ${days === 1 ? 'day' : 'days'}`

  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-secondary-500 p-6 text-white sm:p-10">
      <div className="mb-3 text-3xl">🎒</div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wider text-primary-200">{label}</p>
      <h2 className="mb-1 text-2xl font-bold sm:text-3xl">
        {campName ? `${campName} — ${session.name}` : session.name}
      </h2>
      <p className="mb-6 text-sm text-default-100/80 sm:text-base">
        {formatRange(session.startDate, session.endDate)}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button as={Link} href="/bookings" color="primary" radius="lg">
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
