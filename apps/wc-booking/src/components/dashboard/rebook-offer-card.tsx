'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import type { AttendedEligible } from '@/services/reviews.services'

interface RebookOfferCardProps {
  eligible: AttendedEligible
}

export function RebookOfferCard({ eligible }: RebookOfferCardProps) {
  return (
    <div className="mb-8 rounded-3xl bg-warning-50 p-6 sm:p-8">
      <div className="mb-3 text-3xl">🔁</div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        Loved it? Rebook {eligible.name} next year
      </h3>
      <p className="mb-5 max-w-2xl text-sm text-default-500">
        Returning families often get first pick of dates. Take a look at what&apos;s open for next
        season.
      </p>
      <Button as={Link} href={`/camp/${eligible.slug}`} color="secondary" radius="lg">
        View camp
      </Button>
    </div>
  )
}
