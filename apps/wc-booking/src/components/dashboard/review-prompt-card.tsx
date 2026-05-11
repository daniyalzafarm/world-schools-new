'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { Star } from 'lucide-react'
import type { AttendedEligible } from '@/services/reviews.services'

interface ReviewPromptCardProps {
  eligible: AttendedEligible
}

export function ReviewPromptCard({ eligible }: ReviewPromptCardProps) {
  return (
    <div className="mb-8 rounded-3xl bg-gradient-to-br from-primary-50 via-primary-100/40 to-default-100 p-6 sm:p-8">
      <div className="mb-3 flex items-center gap-2 text-primary-700">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={20} fill="currentColor" />
        ))}
      </div>
      <h2 className="mb-2 text-xl font-bold text-secondary-500 sm:text-2xl">
        How was {eligible.name}?
      </h2>
      <p className="mb-6 max-w-2xl text-sm text-default-500 sm:text-base">
        Share your experience to help other families find the right camp.
      </p>
      <Button
        as={Link}
        href={`/reviews/write?bookingId=${eligible.attended.bookingId}`}
        color="secondary"
        radius="lg"
      >
        Write a review
      </Button>
    </div>
  )
}
