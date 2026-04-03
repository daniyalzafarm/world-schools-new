'use client'

import React from 'react'
import { cn } from '@world-schools/ui-web'
import { Check, MapPin, Star } from 'lucide-react'
import type { AttendedEligible, EligibleCampItem } from '@/services/reviews.services'

export interface WriteReviewCampSelectCardProps {
  camp: EligibleCampItem | AttendedEligible
  attended?: AttendedEligible['attended']
  onSelect: () => void
}

export function WriteReviewCampSelectCard({
  camp,
  attended,
  onSelect,
}: WriteReviewCampSelectCardProps) {
  const campPhotos = camp.photos as
    | { url?: string; thumbnail?: string; isPrimary?: boolean }[]
    | null
    | undefined
  const primary = campPhotos?.find(p => p.isPrimary)
  const fallback = campPhotos?.[0]
  const imageUrl =
    primary?.url ?? primary?.thumbnail ?? fallback?.url ?? fallback?.thumbnail ?? null
  const reviewCount = camp.reviewCount ?? 0
  const avgRating = camp.avgRating ?? null

  const attendedLabel = attended
    ? `Attended ${new Date(attended.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
    : null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-pointer gap-3 rounded-xl border border-default-200 bg-white p-3 text-left transition-all',
        'hover:border-default-900 hover:shadow-md active:scale-95',
        'dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-400',
        'md:flex-col'
      )}
    >
      <div
        className={cn(
          'relative size-24 shrink-0 overflow-hidden rounded-lg bg-default-100 dark:bg-slate-800',
          'md:h-44 md:w-full'
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl font-semibold text-default-400 dark:text-slate-500">
            {camp.name[0]}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-base font-semibold leading-snug text-default-900 dark:text-white">
          {camp.name}
        </p>

        {camp.locationName ? (
          <div className="flex items-center gap-1 text-sm text-default-500 dark:text-slate-400">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{camp.locationName}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-sm text-default-500 dark:text-slate-400">
          {avgRating != null ? (
            <div className="flex items-center gap-1">
              <Star
                className="size-4 fill-primary-500 text-primary-500"
                strokeWidth={0}
                aria-hidden
              />
              <span>{avgRating.toFixed(2)}</span>
            </div>
          ) : null}
          {avgRating != null && reviewCount > 0 ? (
            <span className="text-default-300 dark:text-slate-600" aria-hidden>
              •
            </span>
          ) : null}
          <span>
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {attendedLabel ? (
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-default-900 dark:bg-primary-900/30 dark:text-primary-100">
            <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden />
            {attendedLabel}
          </span>
        ) : null}
      </div>
    </button>
  )
}
