'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'

interface RecapBannerProps {
  year: number | string
  stats: { label: string; value: string | number }[]
}

export function RecapBanner({ year, stats }: RecapBannerProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-500 to-secondary-700 p-6 text-white sm:p-10">
      <div className="text-center">
        <p className="mb-1 text-sm font-medium uppercase tracking-wider text-primary-200">
          Summer {year}
        </p>
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl">Season Complete!</h2>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold sm:text-3xl">{s.value}</p>
              <p className="text-xs text-white/70 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
        <Button as={Link} href="/camps" color="primary" radius="lg" size="lg">
          Plan next season
        </Button>
      </div>
    </div>
  )
}
