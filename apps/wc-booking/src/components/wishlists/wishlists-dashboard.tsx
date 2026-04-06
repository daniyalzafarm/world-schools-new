'use client'

import React from 'react'
import type { Wishlist } from '@/types/wishlists'
import { WishlistCard } from './wishlist-card'
import { WishlistEmptyState } from './wishlist-empty-state'

interface WishlistsDashboardProps {
  wishlists: Wishlist[]
  isLoading: boolean
  onEdit: (wishlist: Wishlist) => void
  onShare: (wishlist: Wishlist) => void
}

export function WishlistsDashboard({
  wishlists,
  isLoading,
  onEdit,
  onShare,
}: WishlistsDashboardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-[20px] border border-gray-100 overflow-hidden animate-pulse"
          >
            <div className="h-[180px] bg-gray-100" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (wishlists.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        <WishlistEmptyState type="dashboard" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
      {wishlists.map(wishlist => (
        <WishlistCard key={wishlist.id} wishlist={wishlist} onEdit={onEdit} onShare={onShare} />
      ))}
    </div>
  )
}
