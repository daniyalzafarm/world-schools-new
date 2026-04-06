'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { useWishlistsStore } from '@/stores/wishlists-store'

interface WishlistEmptyStateProps {
  type?: 'detail' | 'dashboard'
}

export function WishlistEmptyState({ type = 'detail' }: WishlistEmptyStateProps) {
  const { openCreateModal } = useWishlistsStore()

  if (type === 'dashboard') {
    return (
      <div className="col-span-full text-center py-20 px-5 bg-white rounded-[20px] border-2 border-dashed border-gray-200">
        <div className="w-20 h-20 mx-auto mb-5 bg-[#E8FDF7] rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[#0D8B6D]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Create your first wishlist</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-[400px] mx-auto">
          Save camps you love and organize them into wishlists. Compare options and plan the perfect
          holiday.
        </p>
        <Button
          className="bg-[#1A2B49] text-white font-semibold px-7 py-3 rounded-xl h-auto"
          onPress={openCreateModal}
          startContent={
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Create new list
        </Button>
      </div>
    )
  }

  // detail type
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="w-20 h-20 mb-6 bg-[#E8FDF7] rounded-full flex items-center justify-center">
        <svg
          className="w-10 h-10 text-[#0D8B6D]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2">No camps yet</h2>
      <p className="text-gray-500 text-sm max-w-[340px]">
        Browse camps and add them to this wishlist to start planning.
      </p>
    </div>
  )
}
