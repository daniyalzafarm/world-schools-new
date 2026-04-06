'use client'

import { type ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { Building2, Globe, HelpCircle, Search, X } from 'lucide-react'
import { cn } from '@world-schools/ui-web'

import { Logo } from '@/components/layout/logo'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/stores/auth-store'
import config from '@/config/config'

const PROVIDER_LIST_CAMP_URL = 'https://www.worldcamps.com'

type GuestLink = {
  name: string
  href: string
  icon: ReactNode
  external?: boolean
}

const GUEST_DRAWER_LINKS: GuestLink[] = [
  { name: 'Help centre', href: '/help', icon: <HelpCircle size={20} /> },
]

function CampDrawerGuestPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()

  const handleLink = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      router.push(href)
    }
    onClose()
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <Logo size="sm" showText />
        </div>
        <Button
          type="button"
          isIconOnly
          variant="light"
          radius="full"
          aria-label="Close menu"
          className="shrink-0 text-gray-900"
          onPress={onClose}
        >
          <X size={22} />
        </Button>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <Button
          color="secondary"
          onPress={() => {
            onClose()
            router.push('/auth/signup')
          }}
        >
          Sign up
        </Button>
        <Button
          variant="bordered"
          onPress={() => {
            onClose()
            router.push('/auth/signin')
          }}
        >
          Log in
        </Button>
      </div>

      <div className="mx-3 h-px bg-default-200 dark:bg-gray-700" />

      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3"
        aria-label="Explore"
      >
        {GUEST_DRAWER_LINKS.map(link => (
          <div key={link.name} className="w-full">
            <div
              role="link"
              tabIndex={0}
              onClick={() => handleLink(link.href, link.external)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleLink(link.href, link.external)
                }
              }}
              className="flex h-10 cursor-pointer items-center overflow-hidden whitespace-nowrap rounded-lg p-2 hover:bg-default-100 dark:hover:bg-gray-800"
            >
              <span className="flex min-w-6 justify-center text-default-500">{link.icon}</span>
              <span className="ml-3 flex-1 text-sm font-medium">{link.name}</span>
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

export function CampNavDrawer({
  isOpen,
  onClose,
  id = 'camp-nav-drawer',
}: {
  isOpen: boolean
  onClose: () => void
  id?: string
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const { isInitialized, isAuthenticated } = useAuthStore()

  return (
    <>
      <div
        aria-hidden={!isOpen}
        className={cn(
          'fixed inset-0 z-[1000] bg-black/40 transition-opacity duration-300',
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={cn(
          'fixed left-0 top-0 z-[1001] flex h-full w-[min(280px,100vw)] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900',
          isOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
        )}
      >
        {!isInitialized ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden
            />
          </div>
        ) : !isAuthenticated ? (
          <CampDrawerGuestPanel onClose={onClose} />
        ) : (
          <Sidebar
            variant="camp-drawer"
            sidebarOpen={isOpen}
            setSidebarOpen={open => {
              if (!open) onClose()
            }}
          />
        )}
      </div>
    </>
  )
}
