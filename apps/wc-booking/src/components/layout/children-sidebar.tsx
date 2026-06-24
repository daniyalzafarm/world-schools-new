'use client'

import React, { useEffect } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'
import {
  Activity,
  ArrowLeft,
  Calendar,
  Clock,
  Heart,
  Home,
  Phone,
  Sliders,
  Sparkles,
  User,
} from 'lucide-react'
import { Button } from '@heroui/react'

interface ChildrenSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface NavigationSection {
  title?: string
  items: NavigationItem[]
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  badgeType?: 'count' | 'warning' | 'success'
}

export const ChildrenSidebar: React.FC<ChildrenSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const currentChildId = params.id as string

  const children = useChildrenStore(state => state.children)
  const isLoading = useChildrenStore(state => state.isLoading)
  const fetchChildren = useChildrenStore(state => state.fetchChildren)

  // Some child sub-routes (bookings, wishlists, …) don't load children on their
  // own, so fetch here too to resolve the child's name on deep-links/reloads.
  // `fetchChildren` flips `isLoading` synchronously, so this won't double-fetch
  // alongside a page that also requests it.
  useEffect(() => {
    if (children.length === 0 && !isLoading) {
      fetchChildren().catch(() => undefined)
    }
  }, [children.length, isLoading, fetchChildren])

  const currentChild = children.find(child => child.id === currentChildId)
  const childName = currentChild?.nickname || currentChild?.firstName
  const overviewLabel = childName ? `${childName}'s Profile` : 'Profile'

  const handleNavigation = (href: string) => {
    router.push(href)
    setSidebarOpen(false)
  }

  const isActive = (href: string) => {
    // Overview should only be active on exact child profile path
    // This prevents Overview from being active when on child routes like /account/children/[id]/bookings
    const overviewPath = `/account/children/${currentChildId}`
    if (href === overviewPath) {
      return pathname === overviewPath
    }
    return pathname.startsWith(href)
  }

  const navigationSections: NavigationSection[] = [
    {
      items: [
        {
          name: overviewLabel,
          href: `/account/children/${currentChildId}`,
          icon: <Home size={20} />,
        },
      ],
    },
    {
      title: 'Activity',
      items: [
        {
          name: 'Bookings',
          href: `/account/children/${currentChildId}/bookings`,
          icon: <Calendar size={20} />,
        },
        {
          name: 'History',
          href: `/account/children/${currentChildId}/history`,
          icon: <Clock size={20} />,
        },
        {
          name: 'Wishlists',
          href: `/account/children/${currentChildId}/wishlists`,
          icon: <Heart size={20} />,
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          name: 'Profile info',
          href: `/account/children/${currentChildId}/profile`,
          icon: <User size={20} />,
        },
        {
          name: 'Medical & safety',
          href: `/account/children/${currentChildId}/medical`,
          icon: <Activity size={20} />,
        },
        {
          name: 'Camp preferences',
          href: `/account/children/${currentChildId}/preferences`,
          icon: <Sliders size={20} />,
        },
        {
          name: 'Interests & abilities',
          href: `/account/children/${currentChildId}/interests-and-abilities`,
          icon: <Sparkles size={20} />,
        },
        {
          name: 'Emergency contacts',
          href: `/account/children/${currentChildId}/emergency`,
          icon: <Phone size={20} />,
        },
      ],
    },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Children Sidebar */}
      <aside
        className={cn(
          'h-full bg-white dark:bg-slate-900/95 backdrop-blur-md',
          'border-r border-slate-200 dark:border-slate-700',
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          'w-full lg:w-70',
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="px-6 pt-8 pb-6">
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                aria-label="Back to children list"
                variant="flat"
                size="sm"
                radius="full"
                onPress={() => router.push('/account/children')}
              >
                <ArrowLeft size={16} />
              </Button>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">My Children</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 pb-6">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-2">
                {section.title && (
                  <div className="px-3 py-5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                <div className={cn('space-y-1', !section.title && 'mb-2')}>
                  {section.items.map(item => {
                    const active = isActive(item.href)

                    return (
                      <div
                        key={item.href}
                        onClick={() => handleNavigation(item.href)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm',
                          active
                            ? 'bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                      >
                        <span
                          className={cn(
                            'shrink-0',
                            active ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-semibold',
                              item.badgeType === 'count' &&
                                'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
                              item.badgeType === 'warning' &&
                                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                              item.badgeType === 'success' &&
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
