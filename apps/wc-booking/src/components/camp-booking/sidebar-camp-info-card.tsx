'use client'

import { FcGoogle } from 'react-icons/fc'
import type { Camp } from '@/types/camps'
import { formatRating, formatReviewCount } from '@/utils/rating-format'

interface SidebarCampInfoCardProps {
  camp: Camp | null
  campPhotoUrl: string | null
  campSessionText: string
  systemRating: number | null
  systemReviewsCount: number
  hasSystemReviews: boolean
  googleRating: number | null
  googleReviewsCount: number
  hasGoogleReviews: boolean
  googleReviewsUrl: string | null
  onSessionClick?: () => void
}

export function SidebarCampInfoCard({
  camp,
  campPhotoUrl,
  campSessionText,
  systemRating,
  systemReviewsCount,
  hasSystemReviews,
  googleRating,
  googleReviewsCount,
  hasGoogleReviews,
  googleReviewsUrl,
  onSessionClick,
}: SidebarCampInfoCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
          {campPhotoUrl ? (
            <img
              src={campPhotoUrl}
              alt={camp?.name ?? 'Camp'}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{camp?.name ?? ''}</p>
          <SidebarRatingsRow
            systemRating={systemRating}
            systemReviewsCount={systemReviewsCount}
            hasSystemReviews={hasSystemReviews}
            googleRating={googleRating}
            googleReviewsCount={googleReviewsCount}
            hasGoogleReviews={hasGoogleReviews}
            googleReviewsUrl={googleReviewsUrl}
          />
          {onSessionClick ? (
            <button
              type="button"
              onClick={onSessionClick}
              className="mt-2 cursor-pointer text-sm text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-900"
            >
              {campSessionText}
            </button>
          ) : (
            <p className="mt-2 text-sm text-gray-500">{campSessionText}</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface SidebarRatingsRowProps {
  systemRating: number | null
  systemReviewsCount: number
  hasSystemReviews: boolean
  googleRating: number | null
  googleReviewsCount: number
  hasGoogleReviews: boolean
  googleReviewsUrl: string | null
}

export function SidebarRatingsRow({
  systemRating,
  systemReviewsCount,
  hasSystemReviews,
  googleRating,
  googleReviewsCount,
  hasGoogleReviews,
  googleReviewsUrl,
}: SidebarRatingsRowProps) {
  const googleInner = (
    <>
      <FcGoogle size={14} aria-label="Google" />
      {hasGoogleReviews && googleRating != null ? (
        <>
          <span className="text-yellow-500">★</span>
          <span className="font-semibold text-gray-900">{formatRating(googleRating)}</span>
          <span>({formatReviewCount(googleReviewsCount)})</span>
        </>
      ) : (
        <span>(0 reviews)</span>
      )}
    </>
  )

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
      <span className="flex items-center gap-1">
        {hasSystemReviews && systemRating != null ? (
          <>
            <span className="text-primary-600">★</span>
            <span className="font-semibold text-gray-900">{formatRating(systemRating)}</span>
            <span>({formatReviewCount(systemReviewsCount)})</span>
          </>
        ) : (
          <>
            <span className="text-primary-600">★</span>
            <span>(0 reviews)</span>
          </>
        )}
      </span>
      <span className="text-gray-400">·</span>
      {googleReviewsUrl ? (
        <a
          href={googleReviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-gray-900"
        >
          {googleInner}
        </a>
      ) : (
        <span className="flex items-center gap-1">{googleInner}</span>
      )}
    </div>
  )
}
