'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, House, MessageCircle, Tent } from 'lucide-react'
import { Badge } from '@heroui/react'
import { cn, getInitials } from '@world-schools/ui-web'

import { useAuthStore } from '@/stores/auth-store'
import { useMessagingStore } from '@/stores/messaging-store'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'

interface BottomNavItem {
  name: string
  href: string
  icon?: React.ReactNode
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <House size={22} /> },
  { name: 'Bookings', href: '/bookings', icon: <Calendar size={22} /> },
  { name: 'Messages', href: '/messages', icon: <MessageCircle size={22} /> },
  { name: 'Camps', href: '/camps', icon: <Tent size={22} /> },
  { name: 'Account', href: '/account' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const unreadCount = useUnreadMessagesCount()

  const { activeConversationId } = useMessagingStore()

  const userInitials = getInitials(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`)

  // Hide during an active conversation on mobile (full screen for messaging)
  if (pathname.startsWith('/messages') && activeConversationId) return null

  return (
    <nav className="lg:hidden h-16 bg-white dark:bg-gray-900 border-t border-default-200 dark:border-gray-700 z-40 flex items-stretch pb-[env(safe-area-inset-bottom)] shrink-0">
      {BOTTOM_NAV_ITEMS.map(item => {
        const isActive =
          item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150',
              isActive
                ? 'text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            {item.name === 'Account' ? (
              user?.profilePhotoUrl ? (
                <img
                  src={user.profilePhotoUrl}
                  alt="Account"
                  className={cn(
                    'w-[26px] h-[26px] rounded-full object-cover',
                    isActive && 'border-2 border-primary dark:border-primary-400'
                  )}
                />
              ) : (
                <div
                  className={cn(
                    'w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold',
                    isActive
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'bg-default-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  )}
                >
                  {userInitials}
                </div>
              )
            ) : item.name === 'Messages' && unreadCount ? (
              <Badge
                color="primary"
                content={unreadCount}
                size="sm"
                placement="top-right"
                showOutline={false}
              >
                {item.icon}
              </Badge>
            ) : (
              item.icon
            )}
            <span className="text-[10px] font-medium leading-none">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
