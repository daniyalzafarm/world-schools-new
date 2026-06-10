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
  X,
} from 'lucide-react'
import { cn, getCountryName, useConfirmDialog, UserAvatar } from '@world-schools/ui-web'
import { profileService, type UserProfile } from '@/services/profile.services'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@heroui/react'

const PROFILE_COMPLETE_BANNER_DISMISSED_KEY = 'wc_booking_account_profile_complete_banner_dismissed'

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
const AccountHub = () => {
  const router = useRouter()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showProfileCompleteBanner, setShowProfileCompleteBanner] = useState(false)
  const { logout } = useAuthStore()
  const { confirm } = useConfirmDialog()

  // Load profile data on mount
  useEffect(() => {
    void loadProfile()
  }, [])

  // Default to hidden so SSR/first paint never flashes a dismissed banner.
  useEffect(() => {
    if (localStorage.getItem(PROFILE_COMPLETE_BANNER_DISMISSED_KEY) !== 'true') {
      setShowProfileCompleteBanner(true)
    }
  }, [])

  const handleDismissProfileCompleteBanner = () => {
    setShowProfileCompleteBanner(false)
    localStorage.setItem(PROFILE_COMPLETE_BANNER_DISMISSED_KEY, 'true')
  }

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
        <Button
          isIconOnly
          variant="flat"
          radius="full"
          aria-label="Notifications"
          onPress={() => handleNavigation('/notifications')}
          className="relative w-10 h-10 min-w-10 bg-default-100 dark:bg-slate-800 text-slate-900 dark:text-white shrink-0"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-1.5 border-white dark:border-slate-900" />
        </Button>
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
      {showProfileCompleteBanner && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-primary-900 dark:text-primary-300">
              Profile completion
            </span>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                onPress={handleDismissProfileCompleteBanner}
                aria-label="Dismiss"
                size="sm"
                variant="flat"
                radius="full"
                color="primary"
              >
                <X className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </Button>
            </div>
          </div>
          <div className="h-2 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary-700 dark:bg-primary-500 rounded-full transition-all"
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary-900 dark:text-primary-300">
              Your account profile is complete
            </p>
            <span className="text-sm font-bold text-primary-900 dark:text-primary-300">100%</span>
          </div>
        </div>
      )}

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
