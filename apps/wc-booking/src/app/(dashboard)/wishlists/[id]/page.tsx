'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { WishlistDetailHeader } from '@/components/wishlists/wishlist-detail-header'
import { WishlistCampCard } from '@/components/wishlists/wishlist-camp-card'
import { WishlistEmptyState } from '@/components/wishlists/wishlist-empty-state'
import { WishlistMapPanel } from '@/components/wishlists/wishlist-map-panel'
import { CompareBar } from '@/components/wishlists/compare-bar'
import { ShareWishlistModal } from '@/components/wishlists/modals/share-wishlist-modal'
import { AddToWishlistModal } from '@/components/wishlists/modals/add-to-wishlist-modal'

export default function WishlistDetailPage() {
  const params = useParams<{ id: string }>()
  const wishlistId = params.id

  const {
    activeWishlist,
    isLoadingDetail,
    detailError,
    fetchWishlistDetail,
    clearActiveWishlist,
    clearCompare,
  } = useWishlistsStore()

  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    void fetchWishlistDetail(wishlistId)
    return () => {
      clearActiveWishlist()
      clearCompare()
    }
  }, [wishlistId, fetchWishlistDetail, clearActiveWishlist, clearCompare])

  if (isLoadingDetail) {
    return (
      <div className="h-full flex flex-col overflow-y-auto lg:overflow-hidden">
        {/* Skeleton header */}
        <div className="bg-white border-b border-gray-100 z-50 px-8 py-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gray-100" />
            <div className="h-6 bg-gray-100 rounded w-48" />
          </div>
          <div className="flex gap-2 pl-12">
            <div className="h-8 bg-gray-100 rounded-full w-24" />
            <div className="h-8 bg-gray-100 rounded-full w-20" />
          </div>
        </div>
        <div className="lg:flex-1 lg:flex lg:overflow-hidden">
          <div className="p-8 lg:flex-1 lg:overflow-y-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,320px))] gap-5">
              {Array.from({ length: 2 }).map((_, i) => (
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
          {/* Map skeleton */}
          <div className="w-96 xl:w-md 2xl:w-lg shrink-0 border-l border-gray-100 hidden lg:block">
            <div className="w-full h-full bg-linear-to-b from-[#E8F4F8] to-[#D4E8E0]" />
          </div>
        </div>
      </div>
    )
  }

  if (detailError || !activeWishlist) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        {detailError ?? 'Wishlist not found'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto lg:overflow-hidden">
      {/* Sticky header */}
      <WishlistDetailHeader wishlist={activeWishlist} onShare={() => setShareOpen(true)} />

      {/* Content + map split */}
      <div className="lg:flex-1 lg:flex lg:overflow-hidden">
        {/* Camps grid */}
        <div className="p-8 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
          {!activeWishlist.items?.length ? (
            <WishlistEmptyState type="detail" />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,320px))] gap-5">
              {activeWishlist.items.map(item => (
                <WishlistCampCard key={item.id} id={`wishlist-camp-${item.campId}`} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="w-96 xl:w-md 2xl:w-lg shrink-0 border-l border-gray-100 hidden lg:flex">
          <WishlistMapPanel items={activeWishlist.items ?? []} />
        </div>
      </div>

      {/* Compare bar */}
      <CompareBar wishlistId={wishlistId} />

      {/* Share modal */}
      {shareOpen && (
        <ShareWishlistModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          wishlist={activeWishlist}
        />
      )}

      {/* Add to wishlist modal */}
      <AddToWishlistModal />
    </div>
  )
}
