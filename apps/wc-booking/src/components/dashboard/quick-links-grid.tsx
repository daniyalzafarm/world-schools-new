'use client'

import Link from 'next/link'
import { Calendar, MessageCircle, Search } from 'lucide-react'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'

interface QuickLinkProps {
  href: string
  icon: React.ReactNode
  label: string
  description: string
  badge?: number
}

function QuickLink({ href, icon, label, description, badge }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-4 rounded-2xl border border-default-200 bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="text-sm text-default-500">{description}</p>
      </div>
      {badge != null && badge > 0 && (
        <span className="absolute right-4 top-4 rounded-full bg-danger-500 px-2 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

export function QuickLinksGrid() {
  const unread = useUnreadMessagesCount()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <QuickLink
        href="/camps"
        icon={<Search size={20} />}
        label="Search camps"
        description="Find your next adventure"
      />
      <QuickLink
        href="/bookings"
        icon={<Calendar size={20} />}
        label="My bookings"
        description="Manage upcoming trips"
      />
      <QuickLink
        href="/messages"
        icon={<MessageCircle size={20} />}
        label="Messages"
        description="Chat with camp providers"
        badge={unread}
      />
    </div>
  )
}
