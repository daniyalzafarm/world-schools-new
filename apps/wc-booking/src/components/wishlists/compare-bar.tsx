'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { ArrowLeftRight, X } from 'lucide-react'

interface CompareBarProps {
  wishlistId: string
}

export function CompareBar({ wishlistId }: CompareBarProps) {
  const router = useRouter()
  const { compareIds, clearCompare, activeWishlist } = useWishlistsStore()

  if (compareIds.length < 1) return null

  const canCompare = compareIds.length >= 2
  const items = activeWishlist?.items.filter(i => compareIds.includes(i.campId)) ?? []

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 pt-3 pb-3 pl-5 rounded-2xl flex flex-col items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.2)] z-50">
      {/* Helper text when fewer than 2 camps are selected */}
      {!canCompare && (
        <div className="flex items-center gap-4">
          <span className="text-sm">Select at least 2 camps to compare</span>

          {/* Clear */}
          <button
            className="cursor-pointer text-white/60 hover:text-white p-2 flex items-center justify-center"
            onClick={clearCompare}
          >
            <X />
          </button>
        </div>
      )}
      {canCompare && (
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">
            Compare{' '}
            <span className="bg-primary text-slate-800 px-2 py-0.5 rounded-xl text-sm font-bold">
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
                  className="w-9 h-9 rounded-lg overflow-hidden border-2 border-slate-800"
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
            disabled={!canCompare}
            className={`flex items-center gap-1.5 px-5 py-2.5 bg-primary rounded-xl text-sm font-semibold text-slate-800 transition-colors ${
              canCompare ? 'cursor-pointer hover:bg-emerald-400' : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={() => {
              if (!canCompare) return
              const slugs = items.map(i => i.camp?.slug).filter(Boolean) as string[]
              const qs = new URLSearchParams()
              slugs.forEach((slug, i) => qs.set(`c${i + 1}`, slug))
              const query = qs.toString()
              router.push(`/wishlists/${wishlistId}/compare${query ? `?${query}` : ''}`)
            }}
          >
            <ArrowLeftRight size={16} />
            Compare
          </button>

          {/* Clear */}
          <button
            className="cursor-pointer text-white/60 hover:text-white p-2 flex items-center justify-center"
            onClick={clearCompare}
          >
            <X />
          </button>
        </div>
      )}
    </div>
  )
}
