'use client'

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Spinner,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import type { SpecialCircumstanceType } from '@world-schools/wc-types'
import { GRACE_PERIOD_HOURS } from '@world-schools/wc-utils'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { formatCurrency } from '@/utils/currency'
import type { ParentRefundPreview } from '@/types/camp-booking'

type CircumstanceChoice = 'none' | SpecialCircumstanceType

const CIRCUMSTANCE_OPTIONS: Array<{
  value: CircumstanceChoice
  label: string
  description: string
}> = [
  { value: 'none', label: 'No special circumstance', description: 'Standard policy applies' },
  {
    value: 'medical',
    label: 'Medical emergency',
    description: 'Child can no longer attend due to illness or injury',
  },
  {
    value: 'force_majeure',
    label: 'Force majeure',
    description: 'COVID, natural disaster, travel ban, or similar event',
  },
  {
    value: 'weather',
    label: 'Severe weather',
    description: 'Travel disrupted by severe weather',
  },
]

// Display labels for the override-applied callout. MUST match the radio
// button copy in CIRCUMSTANCE_OPTIONS — same wording on both surfaces avoids
// the "Medical emergency" radio → "Medical-emergency override applied" jolt.
const CIRCUMSTANCE_LABEL: Record<SpecialCircumstanceType, string> = {
  medical: 'Medical emergency',
  force_majeure: 'Force majeure',
  weather: 'Severe weather',
}

interface CancelBookingModalProps {
  bookingGroupId: string
  isOpen: boolean
  onClose: () => void
  /** Called after a successful cancellation so the parent page can refresh. */
  onCancelled: () => void
}

/**
 * Phase 4 — parent-facing booking cancel flow.
 *
 * On open: fetches the live refund preview from the server. The preview is
 * authoritative — the modal does no client-side policy math, it renders
 * exactly what the server returns. This guarantees the amount the parent
 * sees matches the amount they're confirming.
 *
 * On confirm: calls `POST /user/booking-groups/:id/cancel`. The server
 * decides the actual refund mode based on the live booking state at that
 * moment — if a webhook flipped the status between preview and confirm
 * (extremely rare but possible), the server's status guard rejects the
 * cancel rather than silently downgrading to a different mode.
 *
 * UI principle from the Phase 2 lessons: NO global-store mutations during
 * the preview-or-cancel async flow. State stays local; the parent page is
 * notified via `onCancelled` only after the server confirms success.
 */
export function CancelBookingModal({
  bookingGroupId,
  isOpen,
  onClose,
  onCancelled,
}: CancelBookingModalProps) {
  const [preview, setPreview] = useState<ParentRefundPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [circumstance, setCircumstance] = useState<CircumstanceChoice>('none')
  // True while a refund-preview fetch is in flight. Distinct from `preview === null`
  // (initial load) because we want the second behavior on circumstance change:
  // keep the selector interactive but blank the refund figures until the new
  // preview arrives. Otherwise the modal briefly shows the OLD circumstance's
  // numbers under the NEW selection — which the user could confirm by mistake.
  const [isFetchingPreview, setIsFetchingPreview] = useState(false)

  // Fetch the preview when the modal opens or the parent picks a different
  // circumstance. The preview reflects exactly what the server would refund
  // under the chosen claim, so the user sees the impact before confirming.
  // Reset all state on close so the next open hits a clean slate.
  useEffect(() => {
    if (!isOpen) {
      setPreview(null)
      setPreviewError(null)
      setSubmitError(null)
      setSubmitting(false)
      setCircumstance('none')
      setIsFetchingPreview(false)
      return
    }
    let cancelled = false
    setIsFetchingPreview(true)
    setPreviewError(null)
    void (async () => {
      try {
        const result = await bookingGroupsService.refundPreview(bookingGroupId, {
          circumstance: circumstance === 'none' ? null : circumstance,
        })
        if (cancelled) return
        if (!result.success) {
          setPreviewError(
            (result.data as { message?: string })?.message ?? 'Could not load preview'
          )
          return
        }
        setPreview(result.data)
      } catch (err) {
        if (cancelled) return
        setPreviewError((err as Error)?.message ?? 'Could not load preview')
      } finally {
        if (!cancelled) setIsFetchingPreview(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, bookingGroupId, circumstance])

  const handleConfirm = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await bookingGroupsService.cancel(bookingGroupId, {
        circumstance: circumstance === 'none' ? null : circumstance,
      })
      if (!result.success) {
        setSubmitError((result.data as { message?: string })?.message ?? 'Cancellation failed')
        return
      }
      onCancelled()
      onClose()
    } catch (err) {
      setSubmitError((err as Error)?.message ?? 'Unexpected error during cancellation')
    } finally {
      setSubmitting(false)
    }
  }, [bookingGroupId, onCancelled, onClose, circumstance])

  const renderBody = () => {
    if (previewError) {
      return (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {previewError}
        </div>
      )
    }
    if (!preview) {
      return (
        <div className="flex items-center justify-center py-8">
          <Spinner color="primary" />
        </div>
      )
    }

    if (preview.mode === 'not_cancelable') {
      return (
        <div className="rounded-xl border border-default-200 bg-default-50 px-4 py-3 text-sm text-default-700">
          {preview.reason ?? 'This booking can no longer be cancelled.'}
        </div>
      )
    }

    if (preview.mode === 'void_auth') {
      return (
        <div className="space-y-3 text-sm text-default-700">
          <p>
            Cancelling now will release the hold on your card without taking any payment. The camp
            had not yet accepted your request, so no refund is needed.
          </p>
        </div>
      )
    }

    const total = Number(preview.totalRefundMajor)
    const ccy = preview.currency ?? 'EUR'

    if (preview.mode === 'grace') {
      return (
        <div className="space-y-3 text-sm text-default-700">
          <p>
            You&apos;re still within the {GRACE_PERIOD_HOURS}-hour grace period — you&apos;ll
            receive a <strong>full refund of {formatCurrency(total, ccy)}</strong>. Refunds
            typically land within 5–10 business days, depending on your bank.
          </p>
          <RefundBreakdown items={preview.items} currency={ccy} />
        </div>
      )
    }

    // policy mode
    const tier = preview.policy?.matchedTier
    const days = preview.policy?.daysBeforeStart ?? 0
    const applied = preview.policy?.appliedCircumstance ?? null
    // Defensive guards: `applied.type` and `applied.refundPercentage` come
    // from the server and are typed but never validated at the boundary. If
    // a future backend version sends an unknown `type` (e.g. a new
    // circumstance the frontend doesn't ship yet) or a malformed
    // `refundPercentage`, we fall back to safe display text rather than
    // rendering "undefined override applied — your refund was increased to
    // undefined%."
    const appliedLabel = applied
      ? (CIRCUMSTANCE_LABEL[applied.type] ?? 'Special-circumstance')
      : null
    const appliedPercent = applied
      ? typeof applied.refundPercentage === 'number'
        ? `${applied.refundPercentage}%`
        : 'a higher amount'
      : null
    return (
      <div className="space-y-3 text-sm text-default-700">
        {isFetchingPreview ? (
          // During a circumstance-driven refetch we keep the selector
          // interactive (so the user can change their pick again) but
          // replace the refund figures + breakdown with skeletons so we
          // never display the OLD circumstance's numbers under the NEW
          // selection. Confirm is also disabled below until the new preview
          // arrives. Skeletons mimic the loaded layout (refund-amount line,
          // explanation line, breakdown card) so the UI doesn't reflow when
          // the data lands.
          <PolicyBodySkeleton />
        ) : (
          <>
            <p>
              Per the camp&apos;s cancellation policy, you&apos;ll receive a refund of{' '}
              <strong>{formatCurrency(total, ccy)}</strong>.
            </p>
            <p className="text-xs text-default-500">
              Cancellation is {days} day{days === 1 ? '' : 's'} before camp start
              {tier ? ` — policy tier returns ${tier.refundPercentage}%.` : '.'} The deposit is
              non-refundable after the {GRACE_PERIOD_HOURS}-hour grace period.
            </p>
            {applied && appliedLabel && appliedPercent ? (
              <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
                {appliedLabel} override applied — your refund was increased to{' '}
                <strong>{appliedPercent}</strong> based on this camp&apos;s special-circumstance
                policy.
              </div>
            ) : null}
          </>
        )}
        <CircumstanceSelector
          value={circumstance}
          onChange={setCircumstance}
          disabled={submitting}
        />
        {isFetchingPreview ? null : <RefundBreakdown items={preview.items} currency={ccy} />}
      </div>
    )
  }

  // Confirm is disabled while a preview re-fetch is in flight: the displayed
  // figures don't yet reflect the user's current circumstance pick, and we
  // don't want them to confirm against stale numbers.
  const canConfirm =
    !!preview &&
    preview.mode !== 'not_cancelable' &&
    !submitting &&
    !previewError &&
    !isFetchingPreview

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>Cancel this booking?</span>
          <span className="text-xs font-normal text-default-500">
            We&apos;ll calculate the refund based on your camp&apos;s policy and the time before the
            session starts.
          </span>
        </ModalHeader>
        <ModalBody>{renderBody()}</ModalBody>
        <ModalFooter className="flex flex-col gap-3">
          {submitError ? (
            <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {submitError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="flat" onPress={onClose} isDisabled={submitting}>
              Keep booking
            </Button>
            <Button
              color="danger"
              onPress={handleConfirm}
              isDisabled={!canConfirm}
              isLoading={submitting}
            >
              Confirm cancellation
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function PolicyBodySkeleton() {
  // Layout mirrors the loaded policy-mode body so the modal doesn't reflow
  // when the new preview lands: a paragraph-width bar (refund-amount line),
  // two narrower bars (explanation line that wraps), and a breakdown card
  // with a heading + two row pairs. Uses HeroUI's Skeleton for consistency
  // with the rest of the modal's design system (Modal/Button/Spinner all
  // come from @heroui/react) and to inherit theming + dark-mode handling.
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <span className="sr-only">Calculating refund</span>
      <Skeleton className="h-4 w-3/4 rounded" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
      <div className="rounded-xl border border-default-200 bg-default-50 p-3">
        <Skeleton className="h-3 w-1/3 rounded" />
        <div className="mt-3 space-y-2">
          {[0, 1].map(i => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CircumstanceSelector({
  value,
  onChange,
  disabled,
}: {
  value: CircumstanceChoice
  onChange: (next: CircumstanceChoice) => void
  disabled: boolean
}) {
  return (
    <div className="rounded-xl border border-default-200 bg-default-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-default-500">
        Reason for cancellation
      </p>
      <p className="mt-1 text-xs text-default-500">
        Pick a special circumstance if it applies — your camp may offer a higher refund. The
        standard policy applies otherwise.
      </p>
      <div className="mt-3 space-y-1.5">
        {CIRCUMSTANCE_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
              value === opt.value
                ? 'border-primary-300 bg-primary-50'
                : 'border-default-200 bg-white hover:border-default-300'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name="cancel-circumstance"
              value={opt.value}
              checked={value === opt.value}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 cursor-pointer"
            />
            <span className="flex-1">
              <span className="block font-medium text-default-900">{opt.label}</span>
              <span className="block text-default-500">{opt.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function RefundBreakdown({
  items,
  currency,
}: {
  items: { kind: string; originalAmountMajor: string; refundAmountMajor: string }[]
  currency: string
}) {
  if (!items.length) return null
  return (
    <div className="rounded-xl border border-default-200 bg-default-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-default-500">
        Refund breakdown
      </p>
      <div className="mt-2 space-y-1 text-xs text-default-700">
        {items.map(item => {
          const orig = Number(item.originalAmountMajor)
          const refund = Number(item.refundAmountMajor)
          return (
            <div key={item.kind} className="flex justify-between">
              <span className="capitalize">{item.kind.replace(/_/g, ' ')}</span>
              <span>
                {formatCurrency(refund, currency)}{' '}
                <span className="text-default-400">/ {formatCurrency(orig, currency)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
