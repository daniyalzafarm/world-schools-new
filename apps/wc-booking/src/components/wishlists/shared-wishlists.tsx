'use client'

import React from 'react'
import type { SharedWithMeEntry } from '@/types/wishlists'
import { WishlistCard } from './wishlist-card'

interface SharedWishlistsProps {
  entries: SharedWithMeEntry[]
  isLoading: boolean
}

export function SharedWishlists({ entries, isLoading }: SharedWishlistsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse"
          >
            <div className="h-44 bg-gray-100" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 px-5 bg-white rounded-3xl border-2 border-dashed border-gray-200">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary-50 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">No shared wishlists yet</h2>
        <p className="text-gray-500 text-sm max-w-96 mx-auto">
          When someone shares a wishlist with you, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
      {entries.map(entry => (
        <WishlistCard
          key={entry.wishlist.id}
          wishlist={entry.wishlist}
          readOnly
          sharedBy={entry.sharedBy}
        />
      ))}
    </div>
  )
}
