'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Wishlist } from '@/types/wishlists'
import { ListCard } from './list-card'

interface WishlistGridProps {
  wishlists: Wishlist[]
}

export function WishlistGrid({ wishlists }: WishlistGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {wishlists.map(w => (
        <ListCard key={w.id} wishlist={w} />
      ))}
      <Link
        href="/wishlists"
        className="flex min-h-[224px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-default-300 p-6 text-default-500 transition-colors hover:border-foreground hover:text-foreground"
      >
        <Plus size={28} />
        <span className="text-sm font-medium">Create a new list</span>
      </Link>
    </div>
  )
}
