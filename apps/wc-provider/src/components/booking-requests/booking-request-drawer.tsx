'use client'

import React from 'react'
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Spinner,
  Textarea,
} from '@heroui/react'
import { formatCurrency } from '@world-schools/wc-utils'
import {
  ageFromDateOfBirth,
  formatDropoffPickupLabels,
  formatSessionRange,
  providerStatusLabel,
  statusBadgeClass,
} from '@world-schools/wc-frontend-utils'
import type { ProviderBookingGroupDetail } from '@world-schools/wc-types'
import { useConfirmDialog } from '@world-schools/ui-web'
import { X } from 'lucide-react'

export interface BookingRequestDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  detail: ProviderBookingGroupDetail | null
  loading: boolean
  error: string | null
  onRetry: () => void
  actionLoading: boolean
  onAccept: (providerNote: string) => Promise<{ ok: boolean; message?: string }>
  onDecline: (providerNote: string) => Promise<{ ok: boolean; message?: string }>
}

export function BookingRequestDrawer({
  isOpen,
  onOpenChange,
  detail,
  loading,
  error,
  onRetry,
  actionLoading,
  onAccept,
  onDecline,
}: BookingRequestDrawerProps) {
  const { confirm } = useConfirmDialog()
  const [note, setNote] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      setNote('')
      setLocalError(null)
    }
  }, [isOpen, detail?.id])

  const currency = detail?.currency ?? 'CHF'
  const isRequest = detail?.status === 'request'

  const dropoffPickup = detail?.session
    ? formatDropoffPickupLabels(
        detail.session.startDate,
        detail.session.endDate,
        detail.session.arrivalTime,
        detail.session.departureTime,
        detail.session.sessionDayType
      )
    : null

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="right"
      scrollBehavior="inside"
      classNames={{
        base: 'sm:max-w-[480px]',
        wrapper: 'z-[100]',
      }}
    >
      <DrawerContent>
        <>
          <DrawerHeader className="flex flex-col gap-1 border-b border-divider px-6 py-4">
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-default-600">Booking request</p>
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {detail?.camp.name ?? '—'}
                </h2>
                {detail?.parent ? (
                  <p className="mt-1 text-sm text-default-500">
                    {detail.parent.displayName}
                    {detail.parent.email ? (
                      <span className="text-default-400"> · {detail.parent.email}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                aria-label="Close"
                onPress={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {detail ? (
              <span
                className={`mt-2 inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(detail.status)}`}
              >
                {providerStatusLabel(detail.status)}
              </span>
            ) : null}
          </DrawerHeader>

          <DrawerBody className="px-6 py-4">
            {loading && (
              <div className="flex justify-center py-16">
                <Spinner size="lg" label="Loading details" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800 dark:border-danger-900/50 dark:bg-danger-950/40 dark:text-danger-200">
                <p className="font-medium">{error}</p>
                <Button variant="flat" size="sm" className="mt-3" onPress={onRetry}>
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && detail && (
              <div className="space-y-6">
                {detail.camp.coverImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-default-200">
                    <img
                      src={detail.camp.coverImageUrl}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  </div>
                ) : null}

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-default-700">Session</h3>
                  <p className="text-sm text-default-600">
                    {formatSessionRange(
                      detail.session.startDate,
                      detail.session.endDate,
                      detail.session.name
                    )}
                  </p>
                  {dropoffPickup ? (
                    <p className="mt-1 text-xs text-default-500">
                      Check-in {dropoffPickup.dropoffDate}
                      {dropoffPickup.dropoffTime ? ` · ${dropoffPickup.dropoffTime}` : ''} ·
                      Check-out {dropoffPickup.pickupDate}
                      {dropoffPickup.pickupTime ? ` · ${dropoffPickup.pickupTime}` : ''}
                    </p>
                  ) : null}
                </section>

                {detail.specialRequest ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-default-700">Parent message</h3>
                    <p className="whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-sm text-default-700">
                      {detail.specialRequest}
                    </p>
                  </section>
                ) : null}

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-default-700">Children</h3>
                  <ul className="space-y-3">
                    {detail.bookings.map(b => {
                      const age = ageFromDateOfBirth(b.child.dateOfBirth)
                      return (
                        <li
                          key={b.id}
                          className="rounded-xl border border-default-200 p-3 dark:border-default-100/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-default-900 dark:text-default-100">
                                {b.child.firstName}
                                {age != null ? ` (${age})` : ''}
                              </p>
                              {b.addOns.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-xs text-default-600">
                                  {b.addOns.map(a => (
                                    <li key={`${a.campId}-${a.addOnId}`}>
                                      {a.name}
                                      {a.quantity > 1 ? ` × ${a.quantity}` : ''} ·{' '}
                                      {formatCurrency(a.lineTotal, currency)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-xs text-default-500">No add-ons</p>
                              )}
                            </div>
                            <div className="text-right text-sm font-semibold text-default-900 dark:text-default-100">
                              {formatCurrency(b.totalPrice, currency)}
                            </div>
                          </div>
                          {b.providerNote ? (
                            <p className="mt-2 border-t border-default-100 pt-2 text-xs text-default-500 dark:border-default-100/20">
                              <span className="font-medium text-default-600">Your note: </span>
                              {b.providerNote}
                            </p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-default-700">Pricing</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-default-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(detail.subtotalAmount, currency)}</span>
                    </div>
                    {detail.discountTotal > 0 ? (
                      <div className="flex justify-between text-success-600">
                        <span>Discounts</span>
                        <span>−{formatCurrency(detail.discountTotal, currency)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-default-200 pt-2 font-semibold text-default-900 dark:border-default-100/20">
                      <span>Total</span>
                      <span>{formatCurrency(detail.totalAmount, currency)}</span>
                    </div>
                    {detail.depositAmount != null && detail.depositAmount > 0 ? (
                      <div className="flex justify-between text-xs text-default-500">
                        <span>Deposit (reference)</span>
                        <span>{formatCurrency(detail.depositAmount, currency)}</span>
                      </div>
                    ) : null}
                  </div>
                </section>

                {localError ? <p className="text-sm text-danger">{localError}</p> : null}
              </div>
            )}
          </DrawerBody>

          {isRequest && detail && !loading && !error ? (
            <DrawerFooter className="flex-col gap-3 border-t border-divider">
              <Textarea
                label="Note to parent (optional)"
                minRows={2}
                value={note}
                onValueChange={setNote}
                placeholder="Visible on the booking after you respond"
              />
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="flat"
                  color="danger"
                  isDisabled={actionLoading}
                  onPress={async () => {
                    setLocalError(null)
                    const ok = await confirm({
                      title: 'Decline this request?',
                      message:
                        'The parent will be notified that their booking request was declined.',
                      confirmText: 'Decline',
                      cancelText: 'Cancel',
                      variant: 'danger',
                    })
                    if (!ok) return
                    const r = await onDecline(note.trim())
                    if (!r.ok) setLocalError(r.message ?? 'Could not decline')
                  }}
                >
                  Decline
                </Button>
                <Button
                  color="primary"
                  isLoading={actionLoading}
                  onPress={async () => {
                    setLocalError(null)
                    const r = await onAccept(note.trim())
                    if (!r.ok) setLocalError(r.message ?? 'Could not accept')
                  }}
                >
                  Accept
                </Button>
              </div>
            </DrawerFooter>
          ) : null}
        </>
      </DrawerContent>
    </Drawer>
  )
}
