'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { Bell, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import { useAuth } from '@/hooks/use-auth'
import { Logo } from '@/components/layout/logo'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Bookings', href: '/bookings' },
  { name: 'Wishlists', href: '/wishlists' },
  { name: 'Messages', href: '/messages' },
]

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()

  // Get user initials for avatar
  const userInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : 'U'

  const userFullName =
    user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User'

  return (
    <nav className="border-b border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex shrink-0 items-center">
            <Logo size="md" showText={true} />
          </div>

          {/* Centered navigation */}
          {isAuthenticated && (
            <div className="hidden sm:flex sm:space-x-8 absolute left-1/2 transform -translate-x-1/2">
              {navigation.map(item => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                      isActive
                        ? 'border-primary text-gray-900 dark:text-gray-100'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    )}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Right side - Auth dependent */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:gap-3">
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <Button
                  isIconOnly
                  variant="light"
                  radius="full"
                  className="text-gray-600 dark:text-gray-400"
                >
                  <Bell size={20} />
                </Button>

                {/* User Profile Dropdown */}
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <div className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full p-1">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-secondary text-sm font-semibold">{userInitials}</span>
                      </div>
                    </div>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="User menu"
                    onAction={key => {
                      if (key === 'profile') {
                        router.push('/settings/profile')
                      } else if (key === 'settings') {
                        router.push('/settings/profile')
                      } else if (key === 'logout') {
                        logout().catch(e => console.error(e))
                        router.push('/auth/signin')
                      }
                    }}
                  >
                    <DropdownItem
                      key="user-info"
                      className="cursor-default"
                      isReadOnly
                      textValue="User info"
                    >
                      <div className="flex flex-col gap-0.5 py-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {userFullName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      </div>
                    </DropdownItem>
                    <DropdownItem
                      key="profile"
                      className="text-gray-700 dark:text-gray-300"
                      startContent={<UserIcon size={16} />}
                    >
                      Profile
                    </DropdownItem>
                    <DropdownItem
                      key="settings"
                      className="text-gray-700 dark:text-gray-300"
                      startContent={<Settings size={16} />}
                    >
                      Settings
                    </DropdownItem>
                    <DropdownItem
                      key="logout"
                      className="text-red-600 dark:text-red-400"
                      startContent={<LogOut size={16} />}
                    >
                      Logout
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </>
            ) : (
              <Button color="primary" radius="full" onPress={() => router.push('/auth/signin')}>
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - TODO: Add mobile menu implementation */}
    </nav>
  )
}
