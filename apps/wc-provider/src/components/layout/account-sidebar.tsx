'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { Bell, Building2, Home, Lock, Phone, Shield, User } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface AccountSidebarProps {
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
}

const navigationSections: NavigationSection[] = [
  {
    items: [
      {
        name: 'Overview',
        href: '/account',
        icon: <Home size={20} />,
      },
    ],
  },
  {
    title: 'Profile',
    items: [
      {
        name: 'Personal info',
        href: '/account/profile/personal-info',
        icon: <User size={20} />,
      },
      {
        name: 'Contact details',
        href: '/account/profile/contact-details',
        icon: <Phone size={20} />,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        name: 'Notifications',
        href: '/account/settings/notifications',
        icon: <Bell size={20} />,
      },
      {
        name: 'Login & security',
        href: '/account/settings/security',
        icon: <Shield size={20} />,
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        name: 'Privacy & Data',
        href: '/account/settings/privacy',
        icon: <Lock size={20} />,
      },
    ],
  },
]

export const AccountSidebar: React.FC<AccountSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { isProviderAdmin } = useAuth()

  const businessInfoSection: NavigationSection = {
    title: 'Business Information',
    items: [
      {
        name: 'Company Details',
        href: '/account/business/company-details',
        icon: <Building2 size={20} />,
      },
    ],
  }

  const sections = isProviderAdmin
    ? [...navigationSections, businessInfoSection]
    : navigationSections

  const handleNavigation = (href: string) => {
    router.push(href)
    setSidebarOpen(false)
  }

  const isActive = (href: string) => {
    if (href === '/account') {
      return pathname === '/account'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
          <div className="px-6 pt-8 pb-6">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Account</h1>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-6">
            {sections.map((section, sectionIndex) => (
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
