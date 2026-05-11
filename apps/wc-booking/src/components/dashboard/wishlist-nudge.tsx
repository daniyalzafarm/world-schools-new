'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { Heart } from 'lucide-react'

export function WishlistNudge() {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-primary-50 to-default-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background text-primary-700">
          <Heart size={22} />
        </div>
        <div>
          <h3 className="mb-1 text-lg font-semibold text-secondary-500">Save camps you love</h3>
          <p className="text-sm text-default-500">
            Build a list to compare camps and share them with your partner.
          </p>
        </div>
      </div>
      <Button as={Link} href="/wishlists" color="secondary" radius="lg">
        Create your first list
      </Button>
    </div>
  )
}
