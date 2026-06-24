'use client'

import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuthStore } from '@/stores/auth-store'
import { isSnapshotActive, useIncompleteBookingStore } from '@/stores/incomplete-booking-store'

/**
 * Shared visibility predicate so the banner and the layout's top offset agree:
 * show only after the client has mounted (avoids an SSR/CSR mismatch from the
 * persisted store), the parent is authenticated, an un-expired snapshot exists,
 * and the parent isn't already on that booking page.
 */
export function useIncompleteBookingVisible(): boolean {
  const snapshot = useIncompleteBookingStore(state => state.snapshot)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const pathname = usePathname()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !isAuthenticated || !isSnapshotActive(snapshot)) return false
  // Hidden while the parent is actively on this booking's page.
  if (pathname === `/book/${snapshot!.campSlug}`) return false
  return true
}

/**
 * App-wide banner shown when the parent has an in-progress booking but has
 * navigated away from the flow (e.g. to add a missing emergency contact).
 * Modeled on the wc-provider impersonation banner.
 */
export function IncompleteBookingBanner() {
  const snapshot = useIncompleteBookingStore(state => state.snapshot)
  const clear = useIncompleteBookingStore(state => state.clear)
  const visible = useIncompleteBookingVisible()
  const router = useRouter()

  if (!visible || !snapshot) return null

  const handleContinue = () => {
    const query = snapshot.bookingGroupId ? `?bookingGroupId=${snapshot.bookingGroupId}` : ''
    router.push(`/book/${snapshot.campSlug}${query}`)
  }

  return (
    <div className="fixed inset-x-0 top-0 z-9999 flex items-center justify-between gap-4 bg-secondary-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <span className="min-w-0 truncate">
        Incomplete booking — {snapshot.campName} · {snapshot.childCount}{' '}
        {snapshot.childCount === 1 ? 'child' : 'children'}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="light" className="text-white" onPress={clear}>
          Discard
        </Button>
        <Button size="sm" color="primary" onPress={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  )
}
