'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { cn, StarRating } from '@world-schools/ui-web'
import { CheckCircle2, MessageSquare, Pencil, ThumbsUp } from 'lucide-react'
import { getTagDefinition } from '@world-schools/wc-types'
import { type CampReview, computeAvgRating, type ReviewTagDimension } from '@/types/reviews'
import { CampResponseModal } from './camp-response-modal'

interface ReviewCardProps {
  review: CampReview
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [responseModalOpen, setResponseModalOpen] = useState(false)

  const avgRating = computeAvgRating(review)
  const campPhotos = review.camp.photos as { url?: string; isPrimary?: boolean }[] | null
  const campImageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  const attendedDate = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const reviewText = review.reviewText ?? ''
  const isLong = reviewText.length > 220
  const displayText = isLong && !expanded ? reviewText.slice(0, 220) + '…' : reviewText

  // Group tags by dimension for display
  const tagsByDimension = review.tags.reduce<Record<string, string[]>>((acc, t) => {
    const def = getTagDefinition(t.dimension as ReviewTagDimension, t.tagValue)
    if (def) {
      acc[t.dimension] = acc[t.dimension] ?? []
      acc[t.dimension].push(def.title)
    }
    return acc
  }, {})

  return (
    <>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
        {/* Header */}
        <div className="flex gap-4 mb-4">
          {/* Camp image */}
          <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden">
            {campImageUrl ? (
              <img
                src={campImageUrl}
                alt={review.camp.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-2xl font-semibold">
                {review.camp.name[0]}
              </div>
            )}
          </div>

          {/* Camp info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">
              {review.camp.name}
            </p>
            {review.camp.locationName && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {review.camp.locationName}
              </p>
            )}
            {attendedDate && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Published {attendedDate}
              </p>
            )}
            {avgRating > 0 && (
              <div className="mt-2">
                <StarRating rating={avgRating} size={14} />
              </div>
            )}
          </div>

          {/* Edit button */}
          <Button
            size="sm"
            variant="flat"
            startContent={<Pencil size={14} />}
            className="shrink-0 self-start"
            onPress={() => router.push(`/reviews/write/${review.campId}?reviewId=${review.id}`)}
          >
            Edit
          </Button>
        </div>

        {/* Review text */}
        {reviewText && (
          <div className="mb-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {displayText}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 mt-1 hover:underline"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        {/* Tag highlights (first dimension that has tags) */}
        {Object.values(tagsByDimension).some(tags => tags.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.values(tagsByDimension)
              .flat()
              .slice(0, 5)
              .map(title => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                >
                  <CheckCircle2 size={12} />
                  {title}
                </span>
              ))}
          </div>
        )}

        {/* Outcomes */}
        {review.outcomes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {review.outcomes.map(outcome => (
              <span
                key={outcome}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
              >
                <CheckCircle2 size={12} />
                {outcome}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
          {review.helpfulCount > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ThumbsUp size={13} />
              <span>{review.helpfulCount} parents found this helpful</span>
            </div>
          ) : (
            <div />
          )}

          {review.response && (
            <button
              onClick={() => setResponseModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300',
                'hover:text-slate-900 dark:hover:text-white transition-colors'
              )}
            >
              <MessageSquare size={13} />
              <span>{review.camp.name} responded</span>
            </button>
          )}
        </div>
      </div>

      {/* Camp Response Modal */}
      {review.response && (
        <CampResponseModal
          isOpen={responseModalOpen}
          onClose={() => setResponseModalOpen(false)}
          campName={review.camp.name}
          response={review.response}
        />
      )}
    </>
  )
}
