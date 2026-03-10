'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import {
  Bell,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  Heart,
  MapPin,
  MessageSquare,
  Shield,
  User,
} from 'lucide-react'
import { profileService, type UserProfile } from '@/services/profile.services'
import { Avatar } from '@heroui/react'

interface QuickLink {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

interface StatCard {
  value: string | number
  label: string
  icon: React.ReactNode
}

interface ActivityItem {
  text: string
  time: string
  icon: React.ReactNode
  iconClass?: string
}

const quickLinks: QuickLink[] = [
  {
    title: 'Personal info',
    description: 'Name, photo, about you',
    href: '/account/profile/personal-info',
    icon: <User size={22} />,
  },
  {
    title: 'Payment methods',
    description: '2 cards saved',
    href: '/account/billing/payment-methods',
    icon: <CreditCard size={22} />,
  },
  {
    title: 'Notifications',
    description: 'Email, push, SMS preferences',
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

const stats: StatCard[] = [
  {
    value: 1,
    label: 'Upcoming booking',
    icon: <Calendar size={20} />,
  },
  {
    value: 8,
    label: 'Saved camps',
    icon: <Heart size={20} />,
  },
  {
    value: 2,
    label: 'Unread messages',
    icon: <MessageSquare size={20} />,
  },
]

const recentActivity: ActivityItem[] = [
  {
    text: 'Payment of €3,590 confirmed for Explorer Summer Camp',
    time: '2 days ago',
    icon: <Check size={18} />,
    iconClass: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  },
  {
    text: 'New message from Alpine Adventure Camp',
    time: '3 days ago',
    icon: <MessageSquare size={18} />,
    iconClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  },
  {
    text: 'You saved Mountain Explorer Camp to your wishlist',
    time: '1 week ago',
    icon: <Heart size={18} />,
    iconClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  },
]

const AccountHub = () => {
  const router = useRouter()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load profile data on mount
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

  // Helper functions
  const getInitials = () => {
    if (!profileData?.firstName && !profileData?.lastName) return '?'
    const first = profileData?.firstName?.[0] || ''
    const last = profileData?.lastName?.[0] || ''
    return `${first}${last}`.toUpperCase()
  }

  const getFullName = () => {
    if (!profileData?.firstName && !profileData?.lastName) return 'User'
    return `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim()
  }

  const getLocation = () => {
    const city = profileData?.city
    const country = profileData?.country
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
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">Account</h1>
        <p className="text-base text-slate-500 dark:text-slate-400">
          Manage your personal info, payments, and settings.
        </p>
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
            {/* Profile photo or initials */}
            {profileData?.profilePhotoUrl ? (
              <div className="shrink-0">
                <Avatar
                  alt={getFullName()}
                  src={profileData.profilePhotoUrl || undefined}
                  name={getFullName()}
                  className="w-24 h-24 text-4xl"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-linear-to-br from-rose-100 to-teal-50 dark:from-rose-900/30 dark:to-teal-900/30 flex items-center justify-center text-2xl font-semibold text-slate-900 dark:text-white shrink-0">
                {getInitials()}
              </div>
            )}
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
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-primary-900 dark:text-primary-300">
            Profile completion
          </span>
          <span className="text-sm font-bold text-primary-900 dark:text-primary-300">100%</span>
        </div>
        <div className="h-2 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary-700 dark:bg-primary-500 rounded-full transition-all"
            style={{ width: '100%' }}
          />
        </div>
        <p className="text-sm text-primary-900 dark:text-primary-300">
          Your account profile is complete
        </p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center"
          >
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-3 text-slate-900 dark:text-white">
              {stat.icon}
            </div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Quick actions
        </div>
        <div className="space-y-1">
          {quickLinks.map(link => (
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

      {/* Recent Activity */}
      <div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Recent activity
        </div>
        <div className="space-y-0">
          {recentActivity.map((activity, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-4 py-4',
                index !== recentActivity.length - 1 &&
                  'border-b border-slate-200 dark:border-slate-700'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  activity.iconClass
                )}
              >
                {activity.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 dark:text-white mb-1">{activity.text}</p>
                <span className="text-xs text-slate-500 dark:text-slate-400">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default AccountHub
