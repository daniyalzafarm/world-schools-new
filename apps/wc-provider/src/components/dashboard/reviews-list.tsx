'use client'

import Link from 'next/link'
import { MessageSquareReply, Star } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import type { ProviderReviewSummary } from '@/services/provider-reviews.services'

interface ReviewsListProps {
  reviews: ProviderReviewSummary[]
  limit?: number
  emptyLabel?: string
}

function StarRow({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={cn(
            i < full ? 'fill-warning-400 text-warning-400' : 'fill-default-200 text-default-200'
          )}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-foreground">{value.toFixed(1)}</span>
    </div>
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  try {
    const then = new Date(iso).getTime()
    const diff = Math.max(0, Date.now() - then)
    const days = Math.round(diff / 86_400_000)
    if (days < 1) return 'today'
    if (days < 30) return `${days}d ago`
    if (days < 365) return `${Math.round(days / 30)}mo ago`
    return new Date(iso).toLocaleDateString('en', { month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export function ReviewsList({ reviews, limit, emptyLabel = 'No reviews yet.' }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  const shown = limit ? reviews.slice(0, limit) : reviews

  return (
    <div className="grid grid-cols-1 gap-3">
      {shown.map(r => (
        <article key={r.id} className="rounded-2xl border border-default-200 bg-background p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {r.parent.displayName}
              </p>
              <p className="truncate text-xs text-default-500">
                {r.campName} · {formatRelative(r.publishedAt ?? r.createdAt)}
              </p>
            </div>
            <StarRow value={r.averageRating} />
          </div>
          {r.reviewText && <p className="line-clamp-2 text-sm text-default-600">{r.reviewText}</p>}
          <div className="mt-3 flex items-center justify-between">
            {r.response ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                <MessageSquareReply size={12} />
                Responded
              </span>
            ) : (
              <Link
                href="/account"
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
              >
                <MessageSquareReply size={12} />
                Reply
              </Link>
            )}
            {r.helpfulCount > 0 && (
              <span className="text-xs text-default-400">{r.helpfulCount} found this helpful</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
