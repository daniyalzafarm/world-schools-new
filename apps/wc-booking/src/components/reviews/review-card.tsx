'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { cn, StarRating, useConfirmDialog } from '@world-schools/ui-web'
import { CheckCircle2, Dot, MessageSquare, Pencil, ThumbsUp, Trash2 } from 'lucide-react'
import { getTagDefinition } from '@world-schools/wc-types'
import { type CampReview, computeAvgRating, type ReviewTagDimension } from '@/types/reviews'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { useReviewsStore } from '@/stores/reviews-store'
import { CampResponseModal } from './camp-response-modal'

interface ReviewCardProps {
  review: CampReview
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const router = useRouter()
  const { removeReview } = useReviewsStore()
  const { confirm } = useConfirmDialog()
  const [responseModalOpen, setResponseModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete review',
      message: `Are you sure you want to delete your review of ${review.camp.name}? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setIsDeleting(true)
    const isDeleted = await removeReview(review.id)
    if (isDeleted)
      addToast({
        title: 'Success',
        description: 'Review deleted successfully',
        color: 'success',
      })
    setIsDeleting(false)
  }

  const avgRating = computeAvgRating(review)
  const campPhotos = review.camp.photos as { url?: string; isPrimary?: boolean }[] | null
  const campImageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  const attendedDate = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const editedDate = review.editedAt
    ? new Date(review.editedAt).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const reviewText = review.reviewText ?? ''

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
          <div className="flex flex-col gap-1 w-full min-w-0">
            <Link
              href={`/camps/${encodeURIComponent(review.camp.slug)}`}
              className="font-semibold text-slate-900 dark:text-white truncate block hover:underline"
            >
              {review.camp.name}
            </Link>
            {review.camp.locationName && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {review.camp.locationName}
              </p>
            )}
            <div className="flex items-center gap-1">
              {attendedDate && (
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                  Published {attendedDate}
                </p>
              )}
              {editedDate && <Dot className="text-slate-400" size={16} />}
              {editedDate && (
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                  Edited {editedDate}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start">
            <Button
              variant="flat"
              startContent={<Pencil size={14} />}
              onPress={() => router.push(`/reviews/write/${review.campId}?reviewId=${review.id}`)}
            >
              Edit
            </Button>
            <Button
              variant="flat"
              color="danger"
              isIconOnly
              isLoading={isDeleting}
              onPress={handleDelete}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>

        {avgRating > 0 && (
          <StarRating color="yellow" className="my-2" rating={avgRating} size={14} />
        )}

        {/* Review text */}
        <ExpandableText text={reviewText} />

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
        {(review.helpfulCount || review.response) && (
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
        )}
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
