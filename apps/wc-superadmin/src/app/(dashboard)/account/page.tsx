'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronRight, MapPin, Phone, Shield, User } from 'lucide-react'
import { profileService, type UserProfile } from '@/services/profile.services'
import { UserAvatar } from '@world-schools/ui-web'

interface QuickLink {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

const quickLinks: QuickLink[] = [
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

export default function AccountHubPage() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">Account</h1>
        <p className="text-base text-slate-500 dark:text-slate-400">
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
    </>
  )
}
