'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { PenLine, Star } from 'lucide-react'
import { useReviewsStore } from '@/stores/reviews-store'
import { ReviewCard } from '@/components/reviews/review-card'
import { PendingReviewCard } from '@/components/reviews/pending-review-card'

const ReviewSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
    <div className="flex gap-4 mb-4">
      <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
    </div>
  </div>
)

const MyReviewsPage = () => {
  const router = useRouter()
  const {
    published,
    pendingModeration,
    attended,
    isLoading,
    isEligibleLoading,
    fetchReviews,
    fetchEligible,
  } = useReviewsStore()

  useEffect(() => {
    void fetchReviews()
    void fetchEligible()
  }, [])

  const loading = isLoading || isEligibleLoading
  const hasAnyContent = published.length > 0 || pendingModeration.length > 0 || attended.length > 0

  return (
    <>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1">
            My Reviews
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400">
            Manage your camp reviews and share experiences with other families.
          </p>
        </div>
        <Button
          onPress={() => router.push('/reviews/write')}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold px-5 rounded-xl h-auto py-2.5 whitespace-nowrap"
          startContent={<PenLine size={16} />}
        >
          Write a Review
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <ReviewSkeleton />
          <ReviewSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasAnyContent && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-6 py-16 text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star size={24} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No reviews yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Share your camp experiences to help other families make the right choice.
          </p>
          <Button
            onPress={() => router.push('/reviews/write')}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl"
            startContent={<PenLine size={16} />}
          >
            Write your first review
          </Button>
        </div>
      )}

      {/* Pending Moderation section */}
      {!loading && pendingModeration.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pending Moderation
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {pendingModeration.length} review{pendingModeration.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-4">
            {pendingModeration.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      )}

      {/* Published Reviews section */}
      {!loading && published.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Published Reviews
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {published.length} review{published.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-4">
            {published.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      )}

      {/* Eligible to Review section */}
      {!loading && attended.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Awaiting Your Review
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {attended.length} camp{attended.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-4">
            {attended.map(camp => (
              <PendingReviewCard key={camp.attended.bookingId} camp={camp} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default MyReviewsPage
