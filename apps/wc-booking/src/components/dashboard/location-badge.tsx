'use client'

import Link from 'next/link'
import { ChevronDown, MapPin } from 'lucide-react'

interface LocationBadgeProps {
  label: string
  href?: string
}

export function LocationBadge({ label, href = '/account' }: LocationBadgeProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-4 py-2 text-sm text-default-500 hover:bg-default-200"
    >
      <MapPin size={16} />
      <span>{label}</span>
      <ChevronDown size={14} />
    </Link>
  )
}
