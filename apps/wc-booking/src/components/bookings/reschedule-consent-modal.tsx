'use client'

import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import type { ReschedulePendingResponse } from '@world-schools/wc-types'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { formatCurrency } from '@/utils/currency'

interface RescheduleConsentModalProps {
  bookingGroupId: string
  /** Settlement currency (ISO 4217) for amount formatting. */
  currency: string
  isOpen: boolean
  onClose: () => void
  /** Called after a successful consent/decline so the page can refresh. */
  onResolved: () => void
}

type Pending = NonNullable<ReschedulePendingResponse['pending']>

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

/**
 * Programme reschedule consent (Spec v2.5 §9.7). On open it fetches the pending
 * provider proposal + a server-computed preview of the recomputed capture
 * schedule. The customer must re-acknowledge before consenting; declining leaves
 * the original dates (and original schedule) in place.
 */
export function RescheduleConsentModal({
  bookingGroupId,
  currency,
  isOpen,
  onClose,
  onResolved,
}: RescheduleConsentModalProps) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPending(null)
      setLoadError(null)
      setAcknowledged(false)
      setSubmitting(false)
      setSubmitError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const res = await bookingGroupsService.getPendingReschedule(bookingGroupId)
        if (cancelled) return
        if (!res.success) {
          setLoadError((res.data as { message?: string })?.message ?? 'Could not load the proposal')
          return
        }
        setPending(res.data.pending)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error)?.message ?? 'Could not load the proposal')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, bookingGroupId])

  const submit = useCallback(
    async (action: 'consent' | 'decline') => {
      if (!pending) return
      setSubmitting(true)
      setSubmitError(null)
      try {
        const res =
          action === 'consent'
            ? await bookingGroupsService.consentReschedule(bookingGroupId, {
                proposalId: pending.proposalId,
              })
            : await bookingGroupsService.declineReschedule(bookingGroupId, {
                proposalId: pending.proposalId,
              })
        if (!res.success) {
          setSubmitError((res.data as { message?: string })?.message ?? 'Could not submit response')
          return
        }
        onResolved()
        onClose()
      } catch (err) {
        setSubmitError((err as Error)?.message ?? 'Unexpected error')
      } finally {
        setSubmitting(false)
      }
    },
    [bookingGroupId, pending, onResolved, onClose]
  )

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {loadError}
        </div>
      )
    }
    if (loading || !pending) {
      if (!loading && !pending) {
        return (
          <p className="text-sm text-default-600">
            There is no pending date change for this booking.
          </p>
        )
      }
      return (
        <div className="flex items-center justify-center py-8">
          <Spinner color="primary" />
        </div>
      )
    }

    return (
      <div className="space-y-4 text-sm text-default-700">
        <p>
          The camp has proposed moving your programme from{' '}
          <strong>{formatDate(pending.originalStartDate)}</strong> to{' '}
          <strong>{formatDate(pending.proposedStartDate)}</strong>.
        </p>
        {pending.reasonText ? (
          <p className="rounded-xl bg-default-50 px-3 py-2 text-xs italic text-default-600">
            &ldquo;{pending.reasonText}&rdquo;
          </p>
        ) : null}
        <div className="rounded-xl border border-default-200 bg-default-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-default-500">
            Your updated payment schedule
          </p>
          <div className="mt-2 space-y-1 text-xs text-default-700">
            {pending.newSchedule.length === 0 ? (
              <p className="text-default-500">
                No further charges — everything due is already paid.
              </p>
            ) : (
              pending.newSchedule.map(e => (
                <div key={e.sequence} className="flex justify-between">
                  <span className="capitalize">{e.kind}</span>
                  <span>
                    {formatCurrency(e.amount, currency)}{' '}
                    <span className="text-default-400">on {formatDate(e.captureDate)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-xs text-default-500">
          Amounts already charged are unaffected. If you decline, your original dates and schedule
          stay in place.
        </p>
        <Checkbox isSelected={acknowledged} onValueChange={setAcknowledged} isDisabled={submitting}>
          <span className="text-xs">
            I agree to the new dates and the updated payment schedule.
          </span>
        </Checkbox>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>Date change requested</span>
          <span className="text-xs font-normal text-default-500">
            Review the new dates and updated schedule before you agree.
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
            <Button
              variant="flat"
              onPress={() => submit('decline')}
              isDisabled={!pending || submitting}
            >
              Decline
            </Button>
            <Button
              color="primary"
              onPress={() => submit('consent')}
              isDisabled={!pending || !acknowledged || submitting}
              isLoading={submitting}
            >
              Agree to new dates
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
