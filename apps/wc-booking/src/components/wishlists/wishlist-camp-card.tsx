'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WishlistItem } from '@/types/wishlists'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { Button } from '@heroui/react'
import { formatCurrency, getCampCurrency } from '@/utils/currency'
import { formatRating, formatReviewCount } from '@/utils/rating-format'
import { StarRating } from '@world-schools/ui-web'
import { FcGoogle } from 'react-icons/fc'

interface WishlistCampCardProps {
  item: WishlistItem
  readOnly?: boolean
  id?: string
}

export function WishlistCampCard({ item, readOnly = false, id }: WishlistCampCardProps) {
  const router = useRouter()
  const [slideIndex, setSlideIndex] = useState(0)
  const { toggleCompare, compareIds, openAddToWishlistModal } = useWishlistsStore()

  const camp = item.camp
  const photoUrls = (camp?.photos ?? []).map(p => (typeof p === 'string' ? p : p.url))
  const isCompareSelected = compareIds.includes(item.campId)
  const campSlug = camp?.slug

  const currency = getCampCurrency(camp, 'wishlist-camp-card')
  const sessionsToCheck = item.selectedSession ? [item.selectedSession] : (camp?.sessions ?? [])
  let minPrice: number | undefined
  for (const session of sessionsToCheck) {
    let price: number | undefined
    if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
      price = Math.min(...session.ageGroupPrices.map(agp => Number(agp.price)))
    } else if (session.price != null) {
      price = Number(session.price)
    }
    if (price != null && !Number.isNaN(price) && (minPrice === undefined || price < minPrice)) {
      minPrice = price
    }
  }
  const priceLabel = minPrice !== undefined ? formatCurrency(minPrice, currency) : null

  // Google Business Profile: location + reviews.
  const gbp = camp?.provider?.googleBusinessProfile
  const locationLabel =
    [gbp?.city, gbp?.country].filter(Boolean).join(', ') || camp?.locationName || null

  // App (system) reviews computed from the internal CampReview table.
  const systemReviewsCount = camp?.totalReviews ?? 0
  const hasSystemReviews = systemReviewsCount > 0
  const systemRating = hasSystemReviews ? (camp?.overallRating ?? null) : null

  const googleRating = gbp?.rating != null ? Number(gbp.rating) : null
  const googleReviewsCount = gbp?.reviewsCount ?? 0
  const hasGoogleReviews = googleReviewsCount > 0
  const googleReviewsUrl = gbp?.placeId
    ? `https://search.google.com/local/reviews?placeid=${gbp.placeId}`
    : null

  const googleRatingContent = (
    <>
      <FcGoogle size={14} aria-label="Google" />
      {hasGoogleReviews && googleRating != null ? (
        <>
          <span className="font-semibold text-gray-900">{formatRating(googleRating)}</span>
          <span className="text-gray-400">({formatReviewCount(googleReviewsCount)})</span>
        </>
      ) : (
        <span className="text-gray-400">(0 reviews)</span>
      )}
    </>
  )

  function prevSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setSlideIndex(i => (i === 0 ? photoUrls.length - 1 : i - 1))
  }

  function nextSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setSlideIndex(i => (i === photoUrls.length - 1 ? 0 : i + 1))
  }

  function handleWishlistClick(e: React.MouseEvent) {
    e.stopPropagation()
    openAddToWishlistModal(item.campId, {
      name: camp?.name ?? '',
      thumbnail: photoUrls[0] ?? null,
      location: camp?.locationName ?? null,
    })
  }

  return (
    <article
      id={id}
      className={`relative bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
        isCompareSelected
          ? 'border-slate-800 shadow-[0_0_0_2px_#1E2A4A]'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-[0_0_0_2px_#1E2A4A'
      }`}
    >
      {/* Compare checkmark overlay */}
      {isCompareSelected && (
        <div className="absolute top-2.5 left-2.5 w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center z-10">
          <svg
            className="w-3.5 h-3.5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Gallery */}
      <div className="relative aspect-4/3 overflow-hidden bg-gray-100">
        {photoUrls.length > 0 ? (
          <>
            <div
              className="flex h-full transition-transform duration-400 ease-in-out"
              style={{ transform: `translateX(-${slideIndex * 100}%)` }}
            >
              {photoUrls.map((url, i) => (
                <div key={i} className="w-full h-full shrink-0">
                  <img
                    src={url}
                    alt={camp?.name ?? 'Camp'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Nav arrows — visible on hover */}
            {photoUrls.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105"
                  onClick={prevSlide}
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105"
                  onClick={nextSlide}
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Dots */}
                {/* <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photoUrls.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        i === slideIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div> */}
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Heart / wishlist button */}
        {!readOnly && (
          <button
            className="cursor-pointer absolute top-2.5 right-2.5 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-transform hover:scale-110 z-10"
            onClick={handleWishlistClick}
            title="Add to wishlist"
          >
            <svg className="w-4 h-4 fill-red-500 text-red-500" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>

      {/* Card content */}
      <div className="p-3.5">
        {/* Camp name + rating */}
        <div className="flex justify-between items-start mb-1">
          <h2
            className="text-sm font-semibold leading-snug cursor-pointer hover:text-teal-600 transition-colors truncate"
            title={camp?.name ?? 'Unknown Camp'}
            onClick={() => campSlug && router.push(`/camp/${campSlug}`)}
          >
            {camp?.name ?? 'Unknown Camp'}
          </h2>
        </div>

        {/* Location */}
        {locationLabel && (
          <p className="text-sm text-gray-500 mb-1 truncate" title={locationLabel}>
            {locationLabel}
          </p>
        )}

        <div className="flex justify-between items-center mb-2">
          {/* Price */}
          <span className="text-sm font-semibold text-gray-900">
            {priceLabel ? <p>{priceLabel}</p> : <p>No Sessions</p>}
          </span>
          {/* Ratings: app + Google, matching the camp profile page */}
          {camp?.provider && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
              {/* App reviews */}
              <span className="flex items-center gap-1">
                <StarRating rating={1} maxRating={1} color="primary" showRating={false} size={13} />
                {hasSystemReviews && systemRating != null ? (
                  <>
                    <span className="font-semibold text-gray-900">
                      {formatRating(systemRating)}
                    </span>
                    <span className="text-gray-400">({formatReviewCount(systemReviewsCount)})</span>
                  </>
                ) : (
                  <span className="text-gray-400">(0 reviews)</span>
                )}
              </span>

              <span className="text-gray-300">·</span>

              {/* Google reviews */}
              {googleReviewsUrl ? (
                <a
                  href={googleReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  {googleRatingContent}
                </a>
              ) : (
                <span className="flex items-center gap-1">{googleRatingContent}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex justify-between">
            <Button color="primary" onPress={() => campSlug && router.push(`/camp/${campSlug}`)}>
              Book
            </Button>
            <Button
              variant="bordered"
              onPress={() => campSlug && router.push(`/messages?camp=${campSlug}`)}
            >
              Message
            </Button>
            <Button
              variant={isCompareSelected ? 'solid' : 'bordered'}
              color={isCompareSelected ? 'secondary' : 'default'}
              onPress={() => toggleCompare(item.campId)}
            >
              Compare
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}
