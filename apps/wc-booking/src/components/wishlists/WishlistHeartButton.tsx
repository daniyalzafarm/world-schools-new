'use client'

import { useEffect, useRef } from 'react'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useAuthStore } from '@/stores/auth-store'
import { useAuthModalStore } from '@/stores/auth-modal-store'

interface WishlistHeartButtonProps {
  campId: string
  campName: string
  thumbnail: string | null
  locationName: string | null
  className?: string
}

export function WishlistHeartButton({
  campId,
  campName,
  thumbnail,
  locationName,
  className = '',
}: WishlistHeartButtonProps) {
  const { isAuthenticated } = useAuthStore()
  const openAuthModal = useAuthModalStore(state => state.open)
  const { myWishlists, isLoadingList, fetchMyWishlists, openAddToWishlistModal } =
    useWishlistsStore()

  // Re-fetching on myWishlists.length would loop forever for users with zero wishlists,
  // since an empty response keeps the length at 0 and flips isLoadingList back to false.
  const didFetchRef = useRef(false)
  useEffect(() => {
    if (!isAuthenticated) return
    if (didFetchRef.current) return
    if (isLoadingList) return
    didFetchRef.current = true
    void fetchMyWishlists()
  }, [isAuthenticated, isLoadingList, fetchMyWishlists])

  const isSaved = myWishlists.some(w => w.campIds.includes(campId))

  const handleClick = () => {
    const addToWishlist = () =>
      openAddToWishlistModal(campId, { name: campName, thumbnail, location: locationName })

    if (!isAuthenticated) {
      openAuthModal({ context: 'save', onSuccess: addToWishlist })
      return
    }

    addToWishlist()
  }

  return (
    <button
      className={`cursor-pointer flex items-center justify-center gap-2 h-9 w-9 sm:w-auto sm:px-4 bg-white rounded-full border border-gray-200 transition-transform hover:scale-105 shrink-0 ${className}`}
      onClick={handleClick}
      title={isSaved ? 'Update wishlist' : 'Add to wishlist'}
    >
      {isSaved ? (
        <svg className="w-4 h-4 shrink-0 fill-red-500 text-red-500" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 shrink-0 text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
      <span className="hidden sm:inline text-sm font-semibold text-gray-800 whitespace-nowrap">
        {isSaved ? 'Update Wishlist' : 'Add to Wishlist'}
      </span>
    </button>
  )
}
