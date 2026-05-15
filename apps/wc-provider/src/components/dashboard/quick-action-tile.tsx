'use client'

import Link from 'next/link'
import React from 'react'

interface QuickActionTileProps {
  href: string
  icon: React.ReactNode
  label: string
  description: string
}

export function QuickActionTile({ href, icon, label, description }: QuickActionTileProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-default-200 bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="text-sm text-default-500">{description}</p>
      </div>
    </Link>
  )
}
