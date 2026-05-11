'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

export function AddChildButton({ href = '/account/children/new' }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Add a child"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-default-300 text-default-500 transition-colors hover:border-foreground hover:text-foreground"
    >
      <Plus size={18} />
    </Link>
  )
}
