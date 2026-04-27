'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollShadow } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { useAuthStore } from '@/stores/auth-store'
import { WishlistHeartButton } from '@/components/wishlists/WishlistHeartButton'

interface NavLink {
  href: string
  label: string
}

interface WishlistCampInfo {
  id: string
  name: string
  thumbnail: string | null
  locationName: string | null
}

interface InnerPageNavProps {
  links: NavLink[]
  /** When false, bar is off-screen (main topbar stays visible). Matches model-B: show after gallery scrolls past. */
  visible: boolean
  camp?: WishlistCampInfo
}

function getStickyHeaderOffsetPx() {
  if (typeof window === 'undefined') return 64
  return window.matchMedia('(min-width: 768px)').matches ? 64 : 56
}

export function InnerPageNav({ links, visible, camp }: InnerPageNavProps) {
  const [activeSection, setActiveSection] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    const topPx = getStickyHeaderOffsetPx()
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = `#${entry.target.id}`
            setActiveSection(id)
          }
        })
      },
      {
        rootMargin: `-${topPx}px 0px -55% 0px`,
        threshold: 0,
      }
    )

    links.forEach(link => {
      const el = document.querySelector(link.href)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [links])

  const scrollToSection = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      const offset = getStickyHeaderOffsetPx()
      const elementPosition =
        (element as HTMLElement).getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top: elementPosition, behavior: 'smooth' })
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur transition-[transform,opacity] duration-[250ms] ease-in-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'
      )}
      aria-hidden={!visible || undefined}
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-stretch px-5 sm:px-8 xl:px-32 md:h-16">
        <ScrollShadow
          orientation="horizontal"
          hideScrollBar
          className="px-6 md:px-8 xl:px-0 flex min-h-0 min-w-0 flex-1 gap-0 overflow-x-auto sm:-mx-8 xl:mx-0"
        >
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={e => scrollToSection(link.href, e)}
              className={cn(
                'flex shrink-0 items-center text-sm border-b-2 px-4 font-semibold whitespace-nowrap transition-all',
                activeSection === link.href
                  ? 'border-primary font-semibold text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              )}
            >
              {link.label}
            </a>
          ))}
        </ScrollShadow>
        {isAuthenticated && camp && (
          <div className="flex shrink-0 items-center pl-3">
            <WishlistHeartButton
              campId={camp.id}
              campName={camp.name}
              thumbnail={camp.thumbnail}
              locationName={camp.locationName}
            />
          </div>
        )}
      </div>
    </div>
  )
}
