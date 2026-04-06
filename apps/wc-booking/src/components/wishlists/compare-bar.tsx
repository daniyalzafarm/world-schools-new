'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { ChartNoAxesColumn } from 'lucide-react'

interface CompareBarProps {
  wishlistId: string
}

export function CompareBar({ wishlistId }: CompareBarProps) {
  const router = useRouter()
  const { compareIds, clearCompare, activeWishlist } = useWishlistsStore()

  if (compareIds.length < 2) return null

  const items = activeWishlist?.items.filter(i => compareIds.includes(i.campId)) ?? []

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1E2A4A] text-white px-4 pt-3 pb-3 pl-5 rounded-2xl flex items-center gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] z-50">
      <div className="text-[15px] font-medium">
        Compare{' '}
        <span className="bg-[#45F0B5] text-[#1E2A4A] px-2 py-0.5 rounded-xl text-[13px] font-bold">
          {compareIds.length}
        </span>
      </div>

      {/* Thumbnails */}
      <div className="flex ml-2">
        {items.map((item, i) => {
          const rawPhoto = item.camp?.photos?.[0]
          const photo = rawPhoto
            ? typeof rawPhoto === 'string'
              ? rawPhoto
              : rawPhoto.url
            : undefined
          return (
            <div
              key={item.campId}
              className="w-9 h-9 rounded-lg overflow-hidden border-2 border-[#1E2A4A]"
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-600" />
              )}
            </div>
          )
        })}
      </div>

      {/* Compare button */}
      <button
        className="cursor-pointer flex items-center gap-1.5 px-5 py-2.5 bg-[#45F0B5] rounded-[10px] text-[14px] font-semibold text-[#1E2A4A] hover:bg-[#3DE0A5] transition-colors"
        onClick={() => {
          const slugs = items.map(i => i.camp?.slug).filter(Boolean) as string[]
          const qs = new URLSearchParams()
          slugs.forEach((slug, i) => qs.set(`c${i + 1}`, slug))
          const query = qs.toString()
          router.push(`/wishlists/${wishlistId}/compare${query ? `?${query}` : ''}`)
        }}
      >
        <ChartNoAxesColumn size={16} />
        Compare
      </button>

      {/* Clear */}
      <button
        className="text-white/60 hover:text-white p-2 flex items-center justify-center"
        onClick={clearCompare}
      >
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
