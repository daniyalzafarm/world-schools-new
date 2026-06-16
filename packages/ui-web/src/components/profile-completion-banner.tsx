/**
 * Profile Completion Banner
 *
 * Presentational completeness widget shared across World Camps portals
 * (booking, provider, superadmin). Renders a progress bar (success ≥75% /
 * warning <75%), the percentage, and a helper line that either lists the
 * missing items with a CTA routing to the first gap, or confirms completion.
 *
 * Product-agnostic: the host computes `missingItems` and passes `onNavigate`
 * (e.g. Next.js `router.push`) so this component never imports a router.
 *
 * When `dismissStorageKey` is provided and the profile is complete (no missing
 * items), the card shows an X to clear it and remembers the choice in
 * `localStorage`. While the profile is incomplete the card is always shown.
 *
 * @example
 * ```tsx
 * <ProfileCompletionBanner
 *   completion={profileCompletion}
 *   missingItems={missingItems}
 *   onNavigate={router.push}
 *   dismissStorageKey="wc_booking_account_profile_complete_banner_dismissed"
 * />
 * ```
 */

'use client'

import { useState } from 'react'
import { Progress } from '@heroui/react'
import { X } from 'lucide-react'
import { cn } from '../utils/cn'

interface MissingItem {
  label: string
  href: string
}

interface ProfileCompletionBannerProps {
  /** 0–100, drives the bar value and the success/warning colors. */
  completion: number
  /** Missing fields; empty array renders the "complete" state. */
  missingItems: MissingItem[]
  /** Host navigation callback, e.g. Next.js `router.push`. */
  onNavigate: (href: string) => void
  /** When set, a complete card can be dismissed and the choice persists here. */
  dismissStorageKey?: string
  title?: string
  ctaText?: string
  completeText?: string
}

const formatMissing = (labels: string[]) => {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export function ProfileCompletionBanner({
  completion,
  missingItems,
  onNavigate,
  dismissStorageKey,
  title = 'Profile completion',
  ctaText = 'Complete your profile',
  completeText = 'Your account profile is complete',
}: ProfileCompletionBannerProps) {
  const isHealthy = completion >= 75
  const isComplete = missingItems.length === 0
  const canDismiss = Boolean(dismissStorageKey) && isComplete

  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!dismissStorageKey &&
      localStorage.getItem(dismissStorageKey) === 'true'
  )

  const handleDismiss = () => {
    if (dismissStorageKey) localStorage.setItem(dismissStorageKey, 'true')
    setDismissed(true)
  }

  if (canDismiss && dismissed) return null

  return (
    <div
      className={cn(
        'relative rounded-xl p-4 mb-6',
        isHealthy ? 'bg-success-50 dark:bg-success-900/20' : 'bg-warning-50 dark:bg-warning-900/20'
      )}
    >
      <div className={cn('flex items-center justify-between mb-2')}>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-sm font-semibold',
              isHealthy
                ? 'text-success-700 dark:text-success-300'
                : 'text-warning-700 dark:text-warning-300'
            )}
          >
            {title} —
          </span>
          <span
            className={cn(
              'text-sm font-bold',
              isHealthy
                ? 'text-success-700 dark:text-success-300'
                : 'text-warning-700 dark:text-warning-300'
            )}
          >
            {completion}%
          </span>
        </div>
        {canDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleDismiss}
            className="text-success-700 dark:text-success-300 hover:text-success-500 cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <Progress
        aria-label={title}
        value={completion}
        color={isHealthy ? 'success' : 'warning'}
        className="mb-2"
      />
      <p
        className={cn(
          'text-xs',
          isHealthy
            ? 'text-success-700 dark:text-success-300'
            : 'text-warning-700 dark:text-warning-300'
        )}
      >
        {missingItems.length > 0 ? (
          <>
            <button
              onClick={() => onNavigate(missingItems[0].href)}
              className={cn(
                'cursor-pointer font-semibold underline',
                isHealthy ? 'hover:text-success-500' : 'hover:text-warning-500'
              )}
            >
              {ctaText}
            </button>{' '}
            — add {formatMissing(missingItems.map(item => item.label))}.
          </>
        ) : (
          completeText
        )}
      </p>
    </div>
  )
}
