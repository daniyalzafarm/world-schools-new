'use client'

import { useEffect, useState } from 'react'
import { Button, Chip, Progress } from '@heroui/react'
import { PenLine, Star } from 'lucide-react'
import { StarRating } from '@world-schools/ui-web'
import { REVIEW_TAG_CONFIG } from '@world-schools/wc-types'
import { getCampReviews } from '@/services/camps.services'
import type { CampReviewsData, PublicCampReview } from '@/types/reviews'
import { formatRating } from '@/utils/rating-format'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { ReviewsDrawer } from './ReviewsDrawer'

interface ReviewsSectionProps {
  campId: string
  campName: string
  initialData?: CampReviewsData
  externalOpen?: boolean
  onExternalClose?: () => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6ee7b7, #3b82f6)',
  'linear-gradient(135deg, #c4b5fd, #818cf8)',
  'linear-gradient(135deg, #fbbf24, #f97316)',
  'linear-gradient(135deg, #94a3b8, #64748b)',
  'linear-gradient(135deg, #fde68a, #f97316)',
  'linear-gradient(135deg, #a5f3fc, #0ea5e9)',
  'linear-gradient(135deg, #d8b4fe, #a855f7)',
  'linear-gradient(135deg, #fca5a5, #ef4444)',
]

// Flatten all tag definitions into a lookup map: value → title
const TAG_TITLE_MAP: Record<string, string> = Object.values(REVIEW_TAG_CONFIG).reduce(
  (acc, dim) => {
    for (const tag of dim.tags) acc[tag.value] = tag.title
    return acc
  },
  {} as Record<string, string>
)

function formatTagValue(value: string): string {
  return (
    TAG_TITLE_MAP[value] ??
    value
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

function getAvatarGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

function getInitials(first: string | null, last: string | null) {
  return [(first ?? '').charAt(0), (last ?? '').charAt(0)].join('').toUpperCase() || '?'
}

function buildMeta(review: PublicCampReview): string {
  const parts: string[] = []

  // Date: prefer visit month+year, fall back to publishedAt
  if (review.visitMonth && review.visitYear) {
    parts.push(`${MONTHS[review.visitMonth - 1]} ${review.visitYear}`)
  } else if (review.visitYear) {
    parts.push(String(review.visitYear))
  } else if (review.publishedAt) {
    const d = new Date(review.publishedAt)
    parts.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
  }

  if (review.kidAges && review.kidAges.length > 0) parts.push(`Age ${review.kidAges[0]}`)
  if (review.kidTags && review.kidTags.length > 0) parts.push(review.kidTags[0])

  return parts.join(' · ')
}

function ReviewCard({ review }: { review: PublicCampReview }) {
  const { reviewer } = review
  const initials = getInitials(reviewer.firstName, reviewer.lastName)
  const gradient = getAvatarGradient(review.id)
  const locationParts = [reviewer.city, reviewer.country].filter(Boolean)
  const location = locationParts.join(', ')
  const displayName = [
    reviewer.firstName,
    reviewer.lastName ? `${reviewer.lastName.charAt(0)}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const meta = buildMeta(review)

  return (
    <div className="p-5 border border-gray-200 rounded-2xl bg-white flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: gradient }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-tight">{displayName}</div>
          {location && <div className="text-xs text-gray-400">{location}</div>}
        </div>
      </div>

      {review.rating != null && (
        <StarRating rating={review.rating} color="yellow" showRating={false} size={13} />
      )}

      {review.reviewText && (
        <ExpandableText text={review.reviewText} maxLines={4} className="!mb-0" />
      )}

      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {review.tags.map(tag => (
            <Chip
              key={tag}
              size="sm"
              variant="flat"
              classNames={{
                base: 'bg-gray-100 border-none h-auto py-1',
                content: 'text-xs font-medium text-gray-700 px-1',
              }}
            >
              {formatTagValue(tag)}
            </Chip>
          ))}
        </div>
      )}

      {meta && <div className="text-xs text-gray-400">{meta}</div>}
    </div>
  )
}

const CATEGORY_LABELS: { key: keyof CampReviewsData['categoryScores']; label: string }[] = [
  { key: 'happiness', label: "Kid's Experience" },
  { key: 'safety', label: 'Safety' },
  { key: 'communication', label: 'Communication' },
  { key: 'asDescribed', label: 'As described' },
  { key: 'growth', label: 'Growth & learning' },
  { key: 'value', label: 'Value for money' },
]

export function ReviewsSection({
  campId,
  campName,
  initialData,
  externalOpen,
  onExternalClose,
}: ReviewsSectionProps) {
  const [data, setData] = useState<CampReviewsData | null>(initialData ?? null)
  const [loaded, setLoaded] = useState(initialData != null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (initialData != null) return
    getCampReviews(campId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [campId, initialData])

  useEffect(() => {
    if (externalOpen) {
      setIsOpen(true)
      onExternalClose?.()
    }
  }, [externalOpen, onExternalClose])

  if (!loaded) return null

  const hasReviews = data != null && data.totalReviews > 0
  const previewReviews = hasReviews ? data.reviews.slice(0, 4) : []
  const hasMoreReviews = hasReviews && data.totalReviews > previewReviews.length

  return (
    <section
      id="reviews"
      className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
    >
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Reviews</h2>

      {hasReviews ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8 mb-8 items-center">
            {/* Score block */}
            <div className="flex flex-col items-center md:items-start md:pr-8 md:border-r md:border-gray-200 pb-6 md:pb-0 border-b md:border-b-0 border-gray-200 min-w-24">
              <div className="text-5xl font-extrabold leading-none tracking-tight text-gray-900">
                {formatRating(data.overallRating)}
              </div>
              <div className="my-1.5">
                <StarRating
                  rating={data.overallRating ?? 0}
                  color="yellow"
                  showRating={false}
                  size={16}
                />
              </div>
              <div className="text-sm text-gray-400">{data.totalReviews} verified reviews</div>
            </div>

            {/* Category score bars */}
            <div className="flex flex-col gap-2">
              {CATEGORY_LABELS.map(({ key, label }) => {
                const val = data.categoryScores[key]
                if (val == null) return null
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[minmax(0,110px)_1fr_28px] sm:grid-cols-[130px_1fr_30px] gap-2 sm:gap-2.5 items-center text-sm"
                  >
                    <span className="text-gray-600 truncate">{label}</span>
                    <Progress
                      value={(val / 5) * 100}
                      color="primary"
                      size="sm"
                      aria-label={label}
                      classNames={{ track: 'h-1.5' }}
                    />
                    <span className="font-bold text-gray-900 text-right min-w-7">
                      {formatRating(val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Review cards preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {previewReviews.map(r => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>

          {/* View all button */}
          {hasMoreReviews && (
            <Button
              onPress={() => setIsOpen(true)}
              variant="flat"
              className="w-full md:w-auto md:px-6 rounded-xl border border-primary/30 text-sm font-semibold text-secondary bg-primary/10 hover:bg-primary/20"
            >
              View all {data.totalReviews} reviews
            </Button>
          )}

          <ReviewsDrawer
            campName={campName}
            rating={data.overallRating ?? 0}
            totalReviews={data.totalReviews}
            categoryScores={data.categoryScores}
            reviews={data.reviews}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
          />
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center gap-4 py-10 px-6 border-2 border-dashed border-gray-200 rounded-2xl text-center">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={20} className="text-gray-200 fill-gray-200" aria-hidden />
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">No reviews yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Be the first to share your experience at {campName}.
            </p>
          </div>
          <Button
            as="a"
            href="/reviews/write"
            variant="flat"
            startContent={<PenLine size={15} />}
            className="mt-1 rounded-xl border-2 border-primary bg-primary/10 text-secondary font-bold hover:bg-primary/20"
          >
            Write a review
          </Button>
        </div>
      )}
    </section>
  )
}
