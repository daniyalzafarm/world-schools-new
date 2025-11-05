'use client'

import React from 'react'
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { Info } from 'lucide-react'

interface TopNavProps {
  className?: string
}

export function TopNav({ className }: TopNavProps) {
  const router = useRouter()

  return (
    <nav
      className={[
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3',
        'bg-transparent backdrop-blur-0',
      ]
        .concat(className ? [className] : [])
        .join(' ')}
    >
      <div className="flex items-center">
        <Logo size="lg" showText={false} />
      </div>

      <div className="flex items-center gap-2">
        <Button onPress={() => router.push('/auth/signin')} radius="full" color="primary">
          Sign in
        </Button>
        <Button
          variant="bordered"
          radius="full"
          color="primary"
          onPress={() => router.push('/auth/signup')}
          className="font-semibold"
        >
          Sign up for free
        </Button>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly variant="light" aria-label="Settings">
              <Info size={30} className="text-primary" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Quick links">
            <DropdownItem key="privacy" onPress={() => router.push('/privacy-policy')}>
              Privacy Policy
            </DropdownItem>
            <DropdownItem key="terms" onPress={() => router.push('/terms-of-service')}>
              Terms of Service
            </DropdownItem>
            <DropdownItem key="cookies" onPress={() => router.push('/cookie-policy')}>
              Cookie Policy
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </nav>
  )
}

export default TopNav
