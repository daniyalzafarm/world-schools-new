'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'

interface OffSeasonBannerProps {
  year: number
}

export function OffSeasonBanner({ year }: OffSeasonBannerProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-primary-200 bg-primary-50 p-6 sm:p-10">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary-700">
        Off-Season Mode
      </p>
      <h2 className="mb-2 text-2xl font-bold text-secondary-500 sm:text-3xl">
        Time to plan for next year
      </h2>
      <p className="mb-6 max-w-xl text-sm text-default-600 sm:text-base">
        The {year} season has wound down. Use this quiet period to refresh your camp listings,
        update photos, and set up sessions for next year.
      </p>
      <Button
        as={Link}
        href="/camps"
        color="secondary"
        radius="lg"
        endContent={<ArrowRight size={18} />}
      >
        Plan next season
      </Button>
    </div>
  )
}
