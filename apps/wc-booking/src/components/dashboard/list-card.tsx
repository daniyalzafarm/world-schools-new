'use client'

import Link from 'next/link'
import type { Wishlist } from '@/types/wishlists'

interface ListCardProps {
  wishlist: Wishlist
}

export function ListCard({ wishlist }: ListCardProps) {
  const photos = (wishlist.coverPhotos ?? []).slice(0, 4)
  const hasPhotos = photos.length > 0
  const tileCount = Math.min(photos.length, 4) || 1
  const gridClass =
    tileCount === 1
      ? 'grid-cols-1'
      : tileCount === 2
        ? 'grid-cols-2'
        : tileCount === 3
          ? 'grid-cols-2 grid-rows-2'
          : 'grid-cols-2 grid-rows-2'

  return (
    <Link
      href={`/wishlists/${wishlist.id}`}
      className="group block overflow-hidden rounded-3xl border border-default-200 bg-background transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div className={`grid ${gridClass} h-36 gap-0.5 bg-default-200`}>
        {hasPhotos ? (
          photos.map((src, i) => (
            <div
              key={`${wishlist.id}-photo-${i}`}
              className={
                tileCount === 3 && i === 0 ? 'row-span-2 bg-cover bg-center' : 'bg-cover bg-center'
              }
              style={{ backgroundImage: `url(${src})` }}
            />
          ))
        ) : (
          <div className="flex items-center justify-center bg-gradient-to-br from-primary-50 to-default-100 text-3xl">
            {wishlist.icon ?? '❤️'}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2">
          {wishlist.icon && <span className="text-lg">{wishlist.icon}</span>}
          <h3 className="truncate text-base font-semibold text-foreground">{wishlist.name}</h3>
        </div>
        <p className="text-sm text-default-500">
          {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'} saved
        </p>
      </div>
    </Link>
  )
}
