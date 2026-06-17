'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { wishlistsService } from '@/services/wishlists.services'
import type { WishlistDetail } from '@/types/wishlists'
import { useAuthStore } from '@/stores/auth-store'
import { useAuthModalStore } from '@/stores/auth-modal-store'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { WishlistDetailHeader } from '@/components/wishlists/wishlist-detail-header'
import { WishlistCampCard } from '@/components/wishlists/wishlist-camp-card'
import { WishlistEmptyState } from '@/components/wishlists/wishlist-empty-state'
import { WishlistMapPanel } from '@/components/wishlists/wishlist-map-panel'
import { AddToWishlistModal } from '@/components/wishlists/modals/add-to-wishlist-modal'

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-white border-b border-gray-100 z-50 px-8 py-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gray-100" />
          <div className="h-6 bg-gray-100 rounded w-48" />
        </div>
        <div className="flex gap-2 pl-12">
          <div className="h-8 bg-gray-100 rounded-full w-24" />
          <div className="h-8 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="aspect-4/3 bg-gray-100" />
                <div className="p-3.5 space-y-2">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-12 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SharedWishlistTokenPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const { isInitialized, isAuthenticated } = useAuthStore()
  const openAuthModal = useAuthModalStore(state => state.open)
  const openAddToWishlistModal = useWishlistsStore(state => state.openAddToWishlistModal)

  const [wishlist, setWishlist] = useState<WishlistDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Set when a logged-out viewer authenticates in order to save a camp — keeps them on
  // this page (instead of redirecting to the owner's wishlist) so the save can complete.
  const pendingSaveRef = useRef(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const response = await wishlistsService.getByShareToken(token)
      if (response.success) {
        setWishlist(response.data)
      } else {
        setError('This wishlist is not available or the link has expired.')
      }
      setIsLoading(false)
    }
    void load()
  }, [token])

  // Authenticated users go straight to the real wishlist detail page — unless they just
  // authenticated to save a camp, in which case keep them here to finish saving.
  useEffect(() => {
    if (pendingSaveRef.current) return
    if (isInitialized && isAuthenticated && wishlist) {
      router.replace(`/wishlists/${wishlist.id}`)
    }
  }, [isInitialized, isAuthenticated, wishlist, router])

  // While redirecting authenticated users away, show the skeleton — but not when a save is
  // pending (the viewer stays here to finish saving via the auth + add-to-wishlist modals).
  if (!isInitialized || isLoading || (isAuthenticated && wishlist && !pendingSaveRef.current)) {
    return <LoadingSkeleton />
  }

  if (error || !wishlist) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        {error ?? 'Wishlist not found'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <WishlistDetailHeader wishlist={wishlist} readOnly />

      {wishlist.ownerName && (
        <div className="px-8 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
          Shared by {wishlist.ownerName} &mdash; view only
        </div>
      )}

      {/* Content + map split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Camps grid */}
        <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
          {!wishlist.items?.length ? (
            <WishlistEmptyState type="detail" />
          ) : (
            <div className="grid grid-cols-3 gap-5 max-w-full">
              {wishlist.items.map(item => {
                const firstPhoto = item.camp?.photos?.[0]
                const thumbnail =
                  typeof firstPhoto === 'string' ? firstPhoto : (firstPhoto?.url ?? null)
                return (
                  <WishlistCampCard
                    key={item.id}
                    item={item}
                    readOnly
                    onSave={() => {
                      pendingSaveRef.current = true
                      openAuthModal({
                        context: 'save',
                        onSuccess: () =>
                          openAddToWishlistModal(item.campId, {
                            name: item.camp?.name ?? '',
                            thumbnail,
                            location: item.camp?.locationName ?? null,
                          }),
                      })
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="w-96 shrink-0 border-l border-gray-100 hidden lg:flex">
          <WishlistMapPanel items={wishlist.items ?? []} />
        </div>
      </div>

      <AddToWishlistModal skipSuccessView />
    </div>
  )
}
