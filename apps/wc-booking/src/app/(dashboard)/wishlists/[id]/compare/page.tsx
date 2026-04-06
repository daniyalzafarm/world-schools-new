'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import type { Camp } from '@/types/camps'
import { getCampBySlug } from '@/services/camps.services'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { WishlistCompareTable } from '@/components/wishlists/wishlist-compare-table'
import { AddToWishlistModal } from '@/components/wishlists/modals/add-to-wishlist-modal'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@heroui/react'

const SLOT_COUNT = 4
const SLOT_KEYS = ['c1', 'c2', 'c3', 'c4'] as const

export default function WishlistComparePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const wishlistId = params.id

  const { fetchMyWishlists, myWishlists, isLoadingList } = useWishlistsStore()

  const [slots, setSlots] = useState<(Camp | null)[]>(Array(SLOT_COUNT).fill(null))
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Pre-fetch wishlists so heart icons show correct fill state immediately
  useEffect(() => {
    if (myWishlists.length === 0 && !isLoadingList) {
      void fetchMyWishlists()
    }
  }, [])

  // Track whether the URL has been applied to avoid re-loading on our own URL pushes
  const syncingUrl = useRef(false)

  // ── Load initial camps from URL slugs ─────────────────────────────────────
  useEffect(() => {
    // Skip if this URL change was triggered by our own syncUrl call
    if (syncingUrl.current) return

    const slugs = SLOT_KEYS.map(k => searchParams.get(k))
    const hasSlugs = slugs.some(Boolean)
    if (!hasSlugs) return

    setIsLoadingSlots(true)
    Promise.all(
      slugs.map(slug => (slug ? getCampBySlug(slug).catch(() => null) : Promise.resolve(null)))
    )
      .then(loaded => {
        setSlots(loaded as (Camp | null)[])
        setIsLoadingSlots(false)
      })
      .catch(() => {
        setIsLoadingSlots(false)
      })
  }, [searchParams])

  // ── Sync slots → URL whenever they change ─────────────────────────────────
  const syncUrl = useCallback(
    (nextSlots: (Camp | null)[]) => {
      const params = new URLSearchParams()
      nextSlots.forEach((camp, i) => {
        if (camp) params.set(SLOT_KEYS[i], camp.slug)
      })
      const qs = params.toString()
      syncingUrl.current = true
      router.replace(`/wishlists/${wishlistId}/compare${qs ? `?${qs}` : ''}`, { scroll: false })
      // Reset after a tick so the searchParams effect can re-arm for external navigations
      setTimeout(() => {
        syncingUrl.current = false
      }, 100)
    },
    [router, wishlistId]
  )

  function handleSlotChange(index: number, camp: Camp | null) {
    const next = slots.map((s, i) => (i === index ? camp : s))
    setSlots(next)
    syncUrl(next)
  }

  const filledCount = slots.filter(Boolean).length

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-50 px-5 py-3.5">
        <div className="max-w-[1320px] mx-auto flex items-center gap-4">
          <Button
            isIconOnly
            variant="flat"
            radius="full"
            size="sm"
            onPress={() => router.push(`/wishlists/${wishlistId}`)}
          >
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h1 className="text-[17px] font-semibold">Compare Camps</h1>
            <div className="text-[13px] text-gray-500">
              {filledCount > 0
                ? `${filledCount} of ${SLOT_COUNT} slots filled — search to add more`
                : 'Search for camps to compare'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto">
        {isLoadingSlots ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#45F0B5]" />
          </div>
        ) : (
          <WishlistCompareTable slots={slots} onSlotChange={handleSlotChange} />
        )}
      </div>
      <AddToWishlistModal skipSuccessView />
    </div>
  )
}
