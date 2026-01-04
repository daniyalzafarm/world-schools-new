'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'
import config from '@/config/config'

interface Step {
  number: number
  title: string
  subtitle: string
  href: string
  completed: boolean
  enabled: boolean
}

interface OnboardingSidebarProps {
  stepCompletion: {
    step1: boolean
    step2: boolean
    step3: boolean
    step4: boolean
    step5: boolean
    step6: boolean
  }
  isOnboardingCompleted?: boolean
  approvalStatus?: string
}

export function OnboardingSidebar({
  stepCompletion,
  isOnboardingCompleted = false,
  approvalStatus,
}: OnboardingSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // Get user initials and full name
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U'
  const userFullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User'

  const steps: Step[] = [
    {
      number: 1,
      title: 'Find Your Camp',
      subtitle: 'Google verification',
      href: '/onboarding/step-1',
      completed: stepCompletion.step1,
      enabled: true, // Step 1 is always enabled
    },
    {
      number: 2,
      title: 'Contact & Account',
      subtitle: 'Create your login',
      href: '/onboarding/step-2',
      completed: stepCompletion.step2,
      enabled: stepCompletion.step1, // Enabled only if step 1 is completed
    },
    {
      number: 3,
      title: 'About Your Camp',
      subtitle: 'Basic info',
      href: '/onboarding/step-3',
      completed: stepCompletion.step3,
      enabled: stepCompletion.step1 && stepCompletion.step2, // Enabled only if steps 1 & 2 are completed
    },
    {
      number: 4,
      title: 'Verification',
      subtitle: 'Documents',
      href: '/onboarding/step-4',
      completed: stepCompletion.step4,
      enabled: stepCompletion.step1 && stepCompletion.step2 && stepCompletion.step3, // Enabled only if steps 1-3 are completed
    },
    {
      number: 5,
      title: 'Payment & Policies',
      subtitle: 'Settings',
      href: '/onboarding/step-5',
      completed: stepCompletion.step5,
      enabled:
        stepCompletion.step1 &&
        stepCompletion.step2 &&
        stepCompletion.step3 &&
        stepCompletion.step4, // Enabled only if steps 1-4 are completed
    },
    {
      number: 6,
      title: 'Acknowledgment',
      subtitle: 'Review & submit',
      href: '/onboarding/step-6',
      completed: stepCompletion.step6,
      enabled:
        stepCompletion.step1 &&
        stepCompletion.step2 &&
        stepCompletion.step3 &&
        stepCompletion.step4 &&
        stepCompletion.step5, // Enabled only if steps 1-5 are completed
    },
    {
      number: 7,
      title: 'Application Status',
      subtitle:
        approvalStatus === 'under_review'
          ? 'Under review'
          : approvalStatus === 'rejected'
            ? 'Rejected'
            : approvalStatus === 'info_requested'
              ? 'Info requested'
              : 'Pending',
      href: '/onboarding/status',
      completed: approvalStatus === 'approved',
      enabled: isOnboardingCompleted, // Enabled only if onboarding is completed
    },
  ]

  return (
    <aside className="fixed left-0 top-0 z-100 flex h-screen w-[280px] flex-col overflow-y-auto border-r border-[#F0F0F0] bg-[#F7F7F7]">
      {/* Logo Header */}
      <div className="flex min-h-[61px] items-center bg-[#F7F7F7] px-5 py-5">
        <div className="flex items-center">
          <Logo size={'md'} showText={true} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6">
        <div className="mb-3 px-5 text-[11px] font-bold uppercase tracking-[0.5px] text-[#717171]">
          ONBOARDING STEPS
        </div>

        {steps.map(step => {
          const isActive = pathname === step.href
          const isCompleted = step.completed
          const isEnabled = step.enabled

          const content = (
            <>
              {/* Active Indicator */}
              {isActive && isEnabled && (
                <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#45F0B5]" />
              )}

              {/* Step Number */}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold',
                  {
                    'border-[#45F0B5] bg-[#45F0B5] text-[#222222]':
                      (isActive || isCompleted) && isEnabled,
                    'border-[#E5E5E5] text-[#717171]': !isActive && !isCompleted && isEnabled,
                    'border-[#E5E5E5] bg-[#F0F0F0] text-[#AAAAAA]': !isEnabled,
                  }
                )}
              >
                {isCompleted ? '✓' : step.number}
              </div>

              {/* Step Info */}
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{step.title}</div>
                <div
                  className={cn('text-[12px]', {
                    'text-[#717171]': isEnabled,
                    'text-[#AAAAAA]': !isEnabled,
                  })}
                >
                  {step.subtitle}
                </div>
              </div>
            </>
          )

          // Render as a div if disabled, Link if enabled
          if (!isEnabled) {
            return (
              <div
                key={step.number}
                className={cn(
                  'relative flex items-center gap-3 px-5 py-3 transition-all cursor-not-allowed font-medium text-[#AAAAAA] opacity-50'
                )}
              >
                {content}
              </div>
            )
          }

          return (
            <Link
              key={step.number}
              href={step.href}
              className={cn('relative flex items-center gap-3 px-5 py-3 transition-all', {
                'bg-white font-semibold text-[#222222]': isActive,
                'font-medium text-[#222222] hover:bg-white/60': !isActive,
              })}
            >
              {content}
            </Link>
          )
        })}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3.5">
        <Dropdown placement="top-end">
          <DropdownTrigger>
            <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/60">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                <span className="text-sm font-semibold text-secondary">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[#222222]">{userFullName}</p>
                <p className="truncate text-xs text-[#717171]">Provider</p>
              </div>
            </div>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="User menu"
            onAction={key => {
              if (key === 'logout') {
                logout().catch(e => console.error(e))
                router.push('/auth/signin')
              }
            }}
          >
            <DropdownItem
              key="logout"
              className="text-red-600 dark:text-red-400"
              startContent={<LogOut size={16} />}
            >
              Logout
            </DropdownItem>
            <DropdownItem key="version" className="cursor-default" isReadOnly textValue="Version">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Version {config.app.version}
              </div>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </aside>
  )
}
