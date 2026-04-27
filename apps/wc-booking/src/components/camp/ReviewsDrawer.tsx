'use client'

import { useState } from 'react'
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Progress,
  ScrollShadow,
} from '@heroui/react'
import { Star } from 'lucide-react'
import { StarRating } from '@world-schools/ui-web'
import { REVIEW_TAG_CONFIG } from '@world-schools/wc-types'
import type { CampReviewCategoryScores, PublicCampReview } from '@/types/reviews'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { formatRating } from '@/utils/rating-format'

interface ReviewsDrawerProps {
  campName: string
  rating: number
  totalReviews: number
  categoryScores: CampReviewCategoryScores | null
  reviews: PublicCampReview[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
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

const CATEGORY_LABELS: { key: keyof CampReviewCategoryScores; label: string }[] = [
  { key: 'happiness', label: "Kid's Experience" },
  { key: 'safety', label: 'Safety' },
  { key: 'communication', label: 'Communication' },
  { key: 'asDescribed', label: 'As described' },
  { key: 'growth', label: 'Growth & learning' },
  { key: 'value', label: 'Value for money' },
]

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
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
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
        <StarRating rating={review.rating} color="primary" showRating={false} size={13} />
      )}

      {review.reviewText && (
        <ExpandableText text={review.reviewText} maxLines={4} className="mb-0!" />
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

      {meta && <p className="text-xs text-gray-400">{meta}</p>}
    </div>
  )
}

const STAR_FILTERS = [0, 5, 4, 3, 2, 1] as const
type StarFilter = (typeof STAR_FILTERS)[number]

export function ReviewsDrawer({
  rating,
  totalReviews,
  categoryScores,
  reviews,
  isOpen,
  onOpenChange,
}: ReviewsDrawerProps) {
  const [starFilter, setStarFilter] = useState<StarFilter>(0)

  const visibleReviews =
    starFilter === 0
      ? reviews
      : reviews.filter(r => r.rating != null && Math.round(r.rating) === starFilter)

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) {
          setStarFilter(0)
          onOpenChange(false)
        }
      }}
      size="4xl"
      placement="center"
      scrollBehavior="outside"
      classNames={{
        base: 'm-0 sm:mx-4 md:h-[65vh]',
        wrapper: 'p-0 sm:p-4 items-end sm:items-center',
        body: 'p-0 overflow-hidden',
        header: 'border-b border-gray-100 px-5 py-4',
      }}
    >
      <ModalContent>
        <ModalHeader className="text-sm font-semibold text-gray-900">
          All reviews ({totalReviews})
        </ModalHeader>

        <ModalBody>
          <div className="flex overflow-hidden" style={{ height: 'calc(90vh - 120px)' }}>
            {/* Left sidebar — desktop only */}
            <div className="hidden md:flex flex-col w-72 shrink-0 border-r border-gray-100 overflow-y-auto">
              <div className="p-6">
                {/* Score */}
                <div className="mb-6">
                  <div className="text-5xl font-extrabold leading-none tracking-tight text-gray-900">
                    {formatRating(rating)}
                  </div>
                  <div className="my-2">
                    <StarRating rating={5} color="primary" showRating={false} size={15} />
                  </div>
                  <p className="text-sm text-gray-400">{totalReviews} verified reviews</p>
                </div>

                {/* Category bars */}
                {categoryScores && (
                  <div className="flex flex-col gap-3">
                    {CATEGORY_LABELS.map(({ key, label }) => {
                      const val = categoryScores[key]
                      if (val == null) return null
                      return (
                        <div key={key} className="flex flex-col text-sm">
                          <span className="text-gray-700 font-medium leading-none">{label}</span>
                          <div className="flex items-center gap-2 w-full">
                            <Progress
                              value={(val / 5) * 100}
                              color="primary"
                              size="sm"
                              aria-label={label}
                              classNames={{ track: 'h-1.5 w-full' }}
                            />
                            <span className="font-bold text-gray-900 text-right">
                              {formatRating(val)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: review list */}
            <div className="flex flex-col overflow-hidden">
              {/* Mobile score strip */}
              <div className="flex md:hidden items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                <span className="text-3xl font-extrabold text-gray-900">
                  {formatRating(rating)}
                </span>
                <div>
                  <StarRating rating={5} color="primary" showRating={false} size={14} />
                  <p className="text-xs text-gray-400 mt-0.5">{totalReviews} reviews</p>
                </div>
              </div>

              {/* Star filter pills */}
              <div className="flex flex-wrap gap-2 px-5 py-4 border-b border-gray-100 shrink-0">
                {STAR_FILTERS.map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={starFilter === s ? 'solid' : 'bordered'}
                    color={starFilter === s ? 'secondary' : 'default'}
                    onPress={() => setStarFilter(s)}
                    className={[
                      'h-8 min-w-0 rounded-full text-sm font-semibold gap-1',
                      starFilter === s ? '' : 'border-gray-200 text-gray-700 bg-white',
                    ].join(' ')}
                  >
                    {s === 0 ? (
                      'All'
                    ) : (
                      <span className="flex items-center gap-1">
                        {Array.from({ length: s }, (_, i) => (
                          <Star key={i} size={11} className="fill-primary text-primary" />
                        ))}
                        {s}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Scrollable list */}
              <ScrollShadow className="flex-1 overflow-y-auto">
                <div className="p-5">
                  {visibleReviews.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {visibleReviews.map(r => (
                        <ReviewCard key={r.id} review={r} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-12">
                      No {starFilter}-star reviews yet.
                    </p>
                  )}
                </div>
              </ScrollShadow>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
