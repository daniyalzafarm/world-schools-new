'use client'

import { Calendar, Heart, MessageCircle } from 'lucide-react'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'
import { ActivityCard } from './activity-card'

interface ActivityGridProps {
  bookingsCount: number
  wishlistsCount: number
}

export function ActivityGrid({ bookingsCount, wishlistsCount }: ActivityGridProps) {
  const unread = useUnreadMessagesCount()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ActivityCard
        icon={<Calendar size={20} />}
        count={bookingsCount}
        label="Bookings"
        href="/bookings"
      />
      <ActivityCard
        icon={<MessageCircle size={20} />}
        count={unread}
        label={unread === 1 ? 'Unread message' : 'Unread messages'}
        href="/messages"
        tone={unread > 0 ? 'warning' : 'default'}
      />
      <ActivityCard
        icon={<Heart size={20} />}
        count={wishlistsCount}
        label={wishlistsCount === 1 ? 'Wishlist' : 'Wishlists'}
        href="/wishlists"
        tone="default"
      />
    </div>
  )
}
