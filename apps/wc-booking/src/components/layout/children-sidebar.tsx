'use client'

import React, { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import {
  Activity,
  Award,
  Calendar,
  Clock,
  Heart,
  Home,
  Phone,
  Plus,
  Sliders,
  User,
} from 'lucide-react'
import type { Child } from '@/types/child'
import { useChildrenStore } from '@/stores/children-store'
import { AddChildModal } from '@/components/modals/add-child-modal'

interface ChildrenSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth: Date | string | undefined): number | null {
  if (!dateOfBirth) return null
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

// Helper function to get avatar initial from child name
function getAvatarInitial(child: Child): string {
  return child.firstName.charAt(0).toUpperCase()
}

// Helper function to get gender-based gradient class
function getGenderGradientClass(gender: string | undefined): string {
  if (gender === 'boy') {
    return 'bg-gradient-to-br from-blue-100 to-teal-50'
  } else if (gender === 'girl') {
    return 'bg-gradient-to-br from-pink-100 to-yellow-50'
  }
  return 'bg-gradient-to-br from-rose-100 to-teal-50'
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
  const { children: childrenList, fetchChildren } = useChildrenStore()

  // State for Add Child Modal
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false)

  // Fetch children data if not already loaded
  useEffect(() => {
    if (childrenList.length === 0) {
      fetchChildren().catch(error => {
        console.error('Failed to fetch children:', error)
      })
    }
  }, [childrenList.length, fetchChildren])

  const handleChildSelect = (childId: string) => {
    router.push(`/children/${childId}`)
    setSidebarOpen(false)
  }

  const handleAddChild = () => {
    setIsAddChildModalOpen(true)
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    setSidebarOpen(false)
  }

  const isActive = (href: string) => {
    // Fix active state logic to prevent multiple items being active
    // Overview should only be active on exact child profile path
    // This prevents Overview from being active when on child routes like /children/[id]/bookings
    const overviewPath = `/children/${currentChildId}`
    if (href === overviewPath) {
      return pathname === overviewPath
    }
    return pathname.startsWith(href)
  }

  // Navigation sections
  const navigationSections: NavigationSection[] = [
    {
      items: [
        {
          name: 'Overview',
          href: `/children/${currentChildId}`,
          icon: <Home size={20} />,
        },
      ],
    },
    {
      title: 'Activity',
      items: [
        {
          name: 'Bookings',
          href: `/children/${currentChildId}/bookings`,
          icon: <Calendar size={20} />,
          badge: 2,
          badgeType: 'count',
        },
        {
          name: 'Wishlists',
          href: `/children/${currentChildId}/wishlists`,
          icon: <Heart size={20} />,
          badge: 3,
          badgeType: 'count',
        },
        {
          name: 'History',
          href: `/children/${currentChildId}/history`,
          icon: <Clock size={20} />,
          badge: 7,
          badgeType: 'count',
        },
        {
          name: 'Certificates',
          href: `/children/${currentChildId}/certificates`,
          icon: <Award size={20} />,
          badge: 5,
          badgeType: 'count',
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          name: 'Profile info',
          href: `/children/${currentChildId}/profile`,
          icon: <User size={20} />,
        },
        {
          name: 'Medical & safety',
          href: `/children/${currentChildId}/medical`,
          icon: <Activity size={20} />,
        },
        {
          name: 'Camp preferences',
          href: `/children/${currentChildId}/preferences`,
          icon: <Sliders size={20} />,
        },
        {
          name: 'Emergency contacts',
          href: `/children/${currentChildId}/emergency`,
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
          // Fixed on mobile, static on desktop (allows main sidebar to push it when expanding)
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          'w-full lg:w-70',
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header with Child Selector */}
          <div className="px-6 pt-8 pb-6">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-5">
              My Children
            </h1>

            {/* Child Selector */}
            <div className="flex flex-col gap-2">
              {childrenList.map(child => {
                const age = calculateAge(child.dateOfBirth)
                const initial = getAvatarInitial(child)
                const gradientClass = getGenderGradientClass(child.gender)
                const isSelected = child.id === currentChildId

                return (
                  <div
                    key={child.id}
                    onClick={() => handleChildSelect(child.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border',
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500'
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${gradientClass} flex items-center justify-center text-base font-semibold text-slate-900 shrink-0`}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {child.firstName}
                      </div>
                      {age !== null && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {age} years old
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add Child Button */}
              <button
                onClick={handleAddChild}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-900 dark:hover:border-slate-300 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium"
              >
                <Plus size={20} />
                Add a child
              </button>
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

      {/* Add Child Modal */}
      <AddChildModal isOpen={isAddChildModalOpen} onClose={() => setIsAddChildModalOpen(false)} />
    </>
  )
}
