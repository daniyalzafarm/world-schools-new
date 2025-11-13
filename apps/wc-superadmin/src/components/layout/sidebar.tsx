'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Badge, Button } from '@heroui/react'
import {
  Activity,
  Bell,
  ChartBarBig,
  ChartPie,
  ChevronLeft,
  Circle,
  Inbox,
  Layers3,
  MessageCircle,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { cn } from '@world-schools/ui-web'

import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  badge?: number
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Analytics Dashboard',
    href: '/analytics-dashboard',
    icon: <ChartBarBig size={18} />,
  },
  {
    label: 'Financial Dashboard',
    href: '/financial-dashboard',
    icon: <ChartPie size={18} />,
  },
  {
    label: 'Provider Requests',
    href: '/provider-requests',
    icon: <Layers3 size={18} />,
    badge: 2,
  },
  {
    label: 'Provider Messages',
    icon: <Inbox size={18} />,
    children: [
      { label: 'My Inbox', href: '/provider-messages/my-inbox', icon: <Circle size={10} /> },
      { label: 'Unassigned', href: '/provider-messages/unassigned', icon: <Circle size={10} /> },
      { label: 'Team Inbox', href: '/provider-messages/team-inbox', icon: <Circle size={10} /> },
    ],
  },
  {
    label: 'User Messages',
    href: '/user-messages',
    icon: <MessageCircle size={18} />,
  },
  {
    label: 'All Providers',
    href: '/all-providers',
    icon: <Activity size={18} />,
  },
  {
    label: 'Users',
    href: '/users',
    icon: <Users2 size={18} />,
  },
  {
    label: 'Roles',
    href: '/roles',
    icon: <ShieldCheck size={18} />,
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: <Bell size={18} />,
    badge: 2,
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuthStore()

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'WC'
    : 'WC'
  const userFullName = user?.firstName ? `${user.firstName} ${user.lastName}`.trim() : 'Superadmin'

  const renderNavItem = (item: NavItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const childIsActive = hasChildren
      ? item.children!.some(child => child.href && pathname.startsWith(child.href))
      : false
    const isActive = item.href ? pathname.startsWith(item.href) : childIsActive

    const content = (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl transition-all select-none',
          depth === 0 ? 'text-sm font-medium' : 'text-xs text-slate-500',
          isActive
            ? 'bg-white text-primary shadow-sm dark:bg-slate-800 dark:text-primary'
            : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
        )}
      >
        <span className={cn('flex items-center justify-center', depth === 0 ? 'w-5' : 'w-3')}>
          {item.badge ? (
            <Badge color="success" content={item.badge} size="sm" placement="top-right" showOutline>
              {item.icon}
            </Badge>
          ) : (
            item.icon
          )}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
      </div>
    )

    return (
      <React.Fragment key={`${item.label}-${depth}`}>
        {item.href ? (
          <Link href={item.href} onClick={onClose} className="block">
            {content}
          </Link>
        ) : (
          content
        )}
        {hasChildren && (
          <div className={cn('space-y-1', 'ml-5 mt-1 mb-2')}>
            {item.children!.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    )
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden transition-opacity',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed z-40 inset-y-0 left-0 w-72 bg-slate-100/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800 flex flex-col transition-transform',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Logo size="md" />
          <Button
            isIconOnly
            variant="light"
            radius="full"
            size="sm"
            className="lg:hidden"
            onPress={onClose}
          >
            <ChevronLeft size={18} />
          </Button>
        </div>
        <div className="px-5 space-y-4 overflow-y-auto pb-10">
          {NAV_ITEMS.map(item => renderNavItem(item))}
        </div>
        <div className="mt-auto px-5 pb-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800 px-4 py-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{userFullName}</p>
                <p className="text-xs text-slate-500 truncate">World Camps HQ</p>
              </div>
            </div>
            <Button
              radius="full"
              variant="ghost"
              className="w-full justify-center text-xs font-semibold text-slate-600 dark:text-slate-200"
              onPress={() => {
                logout()
                router.push('/auth/signin')
                onClose()
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
