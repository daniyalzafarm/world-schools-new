'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  Headphones,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Puzzle,
  Shield,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { cn, getCountryName, useConfirmDialog, UserAvatar } from '@world-schools/ui-web'
import { profileService, type UserProfile } from '@/services/profile.services'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'

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

const baseQuickLinkSections: QuickLinkSection[] = [
  {
    title: 'Profile',
    items: [
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
]

const businessInfoSection: QuickLinkSection = {
  title: 'Business Information',
  items: [
    {
      title: 'Company Details',
      description: 'Business name, registration info',
      href: '/account/business/company-details',
      icon: <Building2 size={22} />,
    },
    {
      title: 'Stripe Account',
      description: 'Connected payment account status',
      href: '/account/business/stripe-account',
      icon: <CreditCard size={22} />,
    },
    {
      title: 'Deposit Settings',
      description: 'Booking deposit amount and type',
      href: '/account/business/deposit-settings',
      icon: <Wallet size={22} />,
    },
    {
      title: 'Payment Policies',
      description: 'Cancellation policy and refund rules',
      href: '/account/business/payment-policies',
      icon: <FileText size={22} />,
    },
  ],
}

export default function AccountHubPage() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isProviderAdmin, logout } = useAuth()
  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()

  useEffect(() => {
    void loadProfile()
  }, [])

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

  const moreItems = [
    {
      title: 'Add-ons',
      description: 'Manage add-ons for your camps',
      href: '/add-ons',
      icon: <Puzzle size={22} />,
    },
    ...(hasPermission('users.read')
      ? [
          {
            title: 'Users',
            description: 'Manage team members',
            href: '/users',
            icon: <Users size={22} />,
          },
        ]
      : []),
    ...(hasPermission('roles.read')
      ? [
          {
            title: 'Roles',
            description: 'Manage roles & permissions',
            href: '/roles',
            icon: <ShieldCheck size={22} />,
          },
        ]
      : []),
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
  ]

  const moreSection = { title: 'More', items: moreItems }

  const quickLinkSections = isProviderAdmin
    ? [businessInfoSection, ...baseQuickLinkSections, moreSection]
    : [...baseQuickLinkSections, moreSection]

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">Account</h1>
        <p className="hidden lg:block text-base text-slate-500 dark:text-slate-400">
          Manage your personal info, contact details, and settings.
        </p>
      </div>

      <div className="flex items-center gap-6 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-6">
        {isLoading ? (
          <>
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
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
            </div>
          </>
        )}
      </div>

      {/* Quick Actions — mobile only (AccountSidebar handles desktop navigation) */}
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
