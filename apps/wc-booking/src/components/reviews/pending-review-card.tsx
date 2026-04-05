'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { Info, PenLine } from 'lucide-react'
import type { AttendedEligible } from '@/services/reviews.services'

interface PendingReviewCardProps {
  camp: AttendedEligible
}

export const PendingReviewCard: React.FC<PendingReviewCardProps> = ({ camp }) => {
  const router = useRouter()

  const campPhotos = camp.photos as { url?: string; isPrimary?: boolean }[] | null
  const campImageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  const attendedDate = new Date(camp.attended.date).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const handleWriteReview = () => {
    const params = new URLSearchParams({
      bookingGroupId: camp.attended.bookingGroupId,
      bookingId: camp.attended.bookingId,
    })
    router.push(`/reviews/write/${camp.id}?${params.toString()}`)
  }

  return (
    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6">
      {/* Header */}
      <div className="flex gap-4 mb-4">
        <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden">
          {campImageUrl ? (
            <img src={campImageUrl} alt={camp.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-2xl font-semibold">
              {camp.name[0]}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{camp.name}</p>
          {camp.locationName && (
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {camp.locationName}
            </p>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Attended {attendedDate}
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 mb-4">
        <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          Your review helps other families find great camps and supports the staff who make a
          difference.
        </p>
      </div>

      {/* CTA */}
      <Button
        onPress={handleWriteReview}
        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl"
        startContent={<PenLine size={16} />}
      >
        Write Review
      </Button>
    </div>
  )
}
