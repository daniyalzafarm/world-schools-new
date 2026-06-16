'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ChevronRight,
  CreditCard,
  Headphones,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Receipt,
  Shield,
  Star,
  User,
  Users,
} from 'lucide-react'
import {
  cn,
  getCountryName,
  ProfileCompletionBanner,
  useConfirmDialog,
  UserAvatar,
} from '@world-schools/ui-web'
import { profileService, type UserProfile } from '@/services/profile.services'
import { useAuthStore } from '@/stores/auth-store'
import { useChildrenStore } from '@/stores/children-store'

interface QuickLink {
  title: string
  description?: string
  href: string
  icon: React.ReactNode
}

interface QuickLinkSection {
  title?: string
  items: QuickLink[]
}

const quickLinkSections: QuickLinkSection[] = [
  {
    title: 'Profile',
    items: [
      {
        title: 'Personal info',
        description: 'Name, photo, about you',
        href: '/account/profile/personal-info',
        icon: <User size={22} />,
      },
      {
        title: 'Contact details',
        description: 'Email, phone number',
        href: '/account/profile/contact-details',
        icon: <Phone size={22} />,
      },
      {
        title: 'Children',
        description: "Manage your children's profiles",
        href: '/account/children',
        icon: <Users size={22} />,
      },
    ],
  },
  {
    title: 'Payments',
    items: [
      {
        title: 'Payment methods',
        description: '2 cards saved',
        href: '/account/billing/payment-methods',
        icon: <CreditCard size={22} />,
      },
      {
        title: 'Receipts & invoices',
        description: 'View your transaction history',
        href: '/account/billing/receipts',
        icon: <Receipt size={22} />,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        title: 'Login & security',
        description: 'Password, 2FA settings',
        href: '/account/settings/security',
        icon: <Shield size={22} />,
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        title: 'Privacy & Data',
        description: 'Manage your privacy settings',
        href: '/account/settings/privacy',
        icon: <Lock size={22} />,
      },
    ],
  },
  {
    title: 'More',
    items: [
      {
        title: 'Reviews',
        href: '/reviews',
        icon: <Star size={22} />,
      },
      {
        title: 'Help',
        href: '/help',
        icon: <HelpCircle size={22} />,
      },
      {
        title: 'Support',
        href: '/support/tickets',
        icon: <Headphones size={22} />,
      },
    ],
  },
]

const quickActions: QuickLink[] = [
  {
    title: 'Personal info',
    description: 'Name, photo',
    href: '/account/profile/personal-info',
    icon: <User size={22} />,
  },
  {
    title: 'Contact details',
    description: 'Email, phone, address',
    href: '/account/profile/contact-details',
    icon: <Phone size={22} />,
  },
  {
    title: 'Notifications',
    description: 'Email, push preferences',
    href: '/account/settings/notifications',
    icon: <Bell size={22} />,
  },
  {
    title: 'Login & security',
    description: 'Password, 2FA settings',
    href: '/account/settings/security',
    icon: <Shield size={22} />,
  },
]

const AccountHub = () => {
  const router = useRouter()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { logout } = useAuthStore()
  const { confirm } = useConfirmDialog()
  const { children, isLoading: childrenLoading, fetchChildren } = useChildrenStore()

  // Load profile data on mount
  useEffect(() => {
    void loadProfile()
  }, [])

  // Children count feeds the "at least one child" completion factor.
  useEffect(() => {
    if (children.length === 0 && !childrenLoading) {
      void fetchChildren()
    }
  }, [children.length, childrenLoading, fetchChildren])

  const profileCompletion = profileData?.parent?.profileCompletion ?? 0

  // Mirrors ProfileCompletionService.recomputeForParent so the prompt below
  // can tell the user which fields are missing and route them to the right page.
  const completionItems = [
    {
      label: 'your name',
      done: Boolean(profileData?.firstName && profileData?.lastName),
      href: '/account/profile/personal-info',
    },
    {
      label: 'profile photo',
      done: Boolean(profileData?.profilePhotoUrl),
      href: '/account/profile/personal-info',
    },
    {
      label: 'nationality',
      done: Boolean(profileData?.parent?.primaryNationality),
      href: '/account/profile/personal-info',
    },
    {
      label: 'the languages you speak',
      done: Boolean(profileData?.parent?.languages?.length),
      href: '/account/profile/personal-info',
    },
    {
      label: 'phone',
      done: Boolean(profileData?.phone),
      href: '/account/profile/contact-details',
    },
    {
      label: 'address',
      done: Boolean(profileData?.address && profileData?.city && profileData?.country),
      href: '/account/profile/contact-details',
    },
    {
      label: "a child's profile",
      done: children.length > 0,
      href: '/account/children',
    },
  ]
  const missingItems = completionItems.filter(item => !item.done)

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const profile = await profileService.getProfile()
      setProfileData(profile)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!confirmed) return
    logout().catch(e => console.error(e))
    router.push('/auth/signin')
  }

  const getFullName = () => {
    if (!profileData?.firstName && !profileData?.lastName) return 'User'
    return `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim()
  }

  const getLocation = () => {
    const city = profileData?.city
    const country = getCountryName(profileData?.country)
    if (!city && !country) return 'Location not set'
    if (city && country) return `${city}, ${country}`
    return city || country || 'Location not set'
  }

  const getMemberDuration = () => {
    // TODO: Get createdAt from backend - currently not available in User type
    // For now, return a placeholder
    return 'New'
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">Account</h1>
          <p className="hidden lg:block text-base text-slate-500 dark:text-slate-400">
            Manage your personal info, payments, and settings.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="flex items-center gap-6 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-6">
        {isLoading ? (
          <>
            {/* Loading skeleton */}
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
              <div className="flex gap-4">
                <div className="h-12 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-12 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-12 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          </>
        ) : (
          <>
            <UserAvatar photoUrl={profileData?.profilePhotoUrl} fullName={getFullName()} />
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                {getFullName()}
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-3">
                <MapPin size={16} /> {getLocation()}
              </div>
              <div className="flex gap-6">
                <div className="text-start">
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">0</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Camps</div>
                </div>
                <div className="text-start">
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">0</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Reviews</div>
                </div>
                <div className="text-start">
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    {getMemberDuration()}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Member</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile Completion */}
      {!isLoading && (
        <ProfileCompletionBanner
          completion={profileCompletion}
          missingItems={missingItems}
          onNavigate={router.push}
          dismissStorageKey="wc_booking_account_profile_complete_banner_dismissed"
        />
      )}

      {/* Quick Actions — desktop only (mobile uses the full sections below) */}
      <div className="hidden lg:block mb-6">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Quick actions
        </div>
        <div className="space-y-1">
          {quickActions.map(link => (
            <div
              key={link.href}
              onClick={() => handleNavigation(link.href)}
              className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="w-11 h-11 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0 text-slate-900 dark:text-white">
                {link.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                  {link.title}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{link.description}</div>
              </div>
              <ChevronRight size={20} className="text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions — mobile only (sidebar handles desktop) */}
      <div className="lg:hidden">
        {quickLinkSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.title && (
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 pt-5 pb-2">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map(link => (
                <div
                  key={link.href}
                  onClick={() => handleNavigation(link.href)}
                  className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="w-11 h-11 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0 text-slate-900 dark:text-white">
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                      {link.title}
                    </div>
                    {link.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {link.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={20} className="text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-4 p-3 mt-2 rounded-lg cursor-pointer transition-colors',
            'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          )}
        >
          <div className="w-11 h-11 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center shrink-0">
            <LogOut size={22} />
          </div>
          <span className="text-base font-medium">Logout</span>
        </div>
      </div>
    </>
  )
}

export default AccountHub
