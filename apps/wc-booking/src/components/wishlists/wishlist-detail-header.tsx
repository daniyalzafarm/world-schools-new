'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import type { WishlistDetail } from '@/types/wishlists'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { ChevronLeft } from 'lucide-react'

interface WishlistDetailHeaderProps {
  wishlist: WishlistDetail
  onShare?: () => void
  readOnly?: boolean
}

export function WishlistDetailHeader({
  wishlist,
  onShare,
  readOnly = false,
}: WishlistDetailHeaderProps) {
  const router = useRouter()
  const { openShareModal } = useWishlistsStore()

  const childrenNames = wishlist.children
    .map(c => c.child?.firstName)
    .filter(Boolean)
    .join(', ')

  const shareCount = wishlist.shares?.length ?? 0

  return (
    <header className="sticky top-0 bg-white z-50 border-b border-gray-100 w-full">
      <div className="flex flex-col px-8 py-4 w-full max-w-full">
        <div className="flex items-start gap-4">
          {!readOnly && (
            <Button
              isIconOnly
              variant="flat"
              size="sm"
              radius="full"
              onPress={() => router.push('/wishlists')}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex flex-col items-start flex-wrap gap-3 mb-3">
            <h1 className="text-xl font-semibold tracking-tight flex-1 truncate">
              {wishlist.icon && <span className="mr-2">{wishlist.icon}</span>}
              {wishlist.name}
            </h1>
            <div className="flex items-center gap-2">
              {/* Children pill */}
              {childrenNames && (
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[13px] font-medium text-gray-900 whitespace-nowrap">
                  <svg
                    className="w-3.5 h-3.5 text-gray-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {childrenNames}
                </button>
              )}

              {/* Share pill */}
              {!readOnly && (
                <button
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[13px] font-medium text-gray-900 hover:border-gray-200 transition-all whitespace-nowrap"
                  onClick={() => onShare?.() ?? openShareModal()}
                >
                  {shareCount > 0 ? (
                    <div className="flex">
                      {wishlist.shares.slice(0, 3).map((s, i) => (
                        <span
                          key={s.id}
                          className="w-[22px] h-[22px] rounded-full bg-linear-to-br from-blue-100 to-red-100 border-2 border-white flex items-center justify-center text-[9px] font-semibold"
                          style={{ marginLeft: i === 0 ? 0 : -6 }}
                        >
                          {s.email[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5 text-gray-500"
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
                  )}
                  <span className="shared-text">{shareCount > 0 ? 'Shared' : 'Share'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
