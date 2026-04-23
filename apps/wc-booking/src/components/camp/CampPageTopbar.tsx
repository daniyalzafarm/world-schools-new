'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@heroui/react'
import { Menu } from 'lucide-react'
import { cn } from '@world-schools/ui-web'

import { CampNavDrawer } from '@/components/camp/CampNavDrawer'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'
import { WishlistHeartButton } from '@/components/wishlists/WishlistHeartButton'

type WishlistCampInfo = {
  id: string
  name: string
  thumbnail: string | null
  locationName: string | null
}

type CampPageTopbarProps = {
  /** When true, header is hidden (e.g. camp profile inner nav replaces it after scrolling past gallery). */
  suppressed?: boolean
  camp?: WishlistCampInfo
}

export function CampPageTopbar({ suppressed = false, camp }: CampPageTopbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isAuthenticated, isInitialized } = useAuthStore()

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur transition-[transform,opacity,height,border-color] duration-[250ms] ease-in-out',
          suppressed &&
            'pointer-events-none h-0 min-h-0 -translate-y-full overflow-hidden border-transparent opacity-0'
        )}
        aria-hidden={suppressed || undefined}
        inert={suppressed ? true : undefined}
      >
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-5 sm:px-8 lg:px-32 md:h-16">
          <Button
            type="button"
            isIconOnly
            variant="light"
            radius="sm"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="camp-nav-drawer"
            className="h-10 w-10 min-w-10 shrink-0 text-gray-900"
            onPress={() => setDrawerOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
          </Button>
          <Logo showText={false} className="min-w-0 flex-1 sm:hidden" />
          <Logo className="hidden min-w-0 sm:flex sm:flex-none" />
          {isInitialized && !isAuthenticated ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button as={Link} href="/auth/signin" variant="light">
                Log in
              </Button>
              <Button as={Link} href="/auth/signup" color="secondary">
                Sign up
              </Button>
            </div>
          ) : null}
          {isInitialized && isAuthenticated && camp ? (
            <WishlistHeartButton
              className="ml-auto"
              campId={camp.id}
              campName={camp.name}
              thumbnail={camp.thumbnail}
              locationName={camp.locationName}
            />
          ) : null}
        </div>
      </header>
      <CampNavDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
