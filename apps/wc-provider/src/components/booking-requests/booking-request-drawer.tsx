'use client'

import React from 'react'
import {
  addToast,
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react'
import { formatCurrency } from '@world-schools/wc-utils'
import {
  ageFromDateOfBirth,
  formatDropoffPickupLabels,
  formatSessionRange,
  providerRequestBannerVariant,
} from '@world-schools/wc-frontend-utils'
import type { BookingGroupStatus, ProviderBookingGroupDetail } from '@world-schools/wc-types'
import { cn, Textarea } from '@world-schools/ui-web'
import { Calendar, Globe, Languages, MapPin, Star } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMessagingStore } from '@/stores/messaging-store'
import { providerBookingGroupsService } from '@/services/provider-booking-groups.services'
import { AcceptBookingConfirmationModal } from './accept-booking-confirmation-modal'
import { DeclineBookingModal, type DeclinePayload } from './decline-booking-modal'

export interface BookingRequestDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  detail: ProviderBookingGroupDetail | null
  loading: boolean
  error: string | null
  onRetry: () => void
  actionLoading: boolean
  onAccept: (providerNote: string) => Promise<{ ok: boolean; message?: string }>
  onDecline: (
    payload: DeclinePayload & { providerNote: string }
  ) => Promise<{ ok: boolean; message?: string }>
  onDetailRefresh?: () => void
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName
}

function formatLocation(p: ProviderBookingGroupDetail['parent']): string | null {
  const parts = [p.city, p.state, p.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000))
}

function formatMediumDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function statusPanelTitle(status: BookingGroupStatus): string {
  switch (status) {
    case 'request':
      return 'Booking request'
    case 'accepted':
    case 'deposit_paid':
    case 'fully_paid':
      return 'Confirmed booking'
    case 'at_camp':
      return 'Active campers'
    case 'completed':
    case 'declined':
    case 'expired':
      return 'Past booking'
    case 'cancelled':
      return 'Cancelled booking'
    default:
      return 'Booking'
  }
}

function headerActionLabel(status: BookingGroupStatus): string {
  switch (status) {
    case 'request':
    case 'completed':
    case 'declined':
    case 'expired':
      return 'Message'
    case 'accepted':
    case 'deposit_paid':
    case 'fully_paid':
      return 'Export'
    case 'at_camp':
      return 'Emergency'
    case 'cancelled':
      return 'Download invoice'
    default:
      return 'Message'
  }
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
  onDetailRefresh,
}: BookingRequestDrawerProps) {
  const router = useRouter()
  const setActiveConversation = useMessagingStore(state => state.setActiveConversation)

  const [note, setNote] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [internalDraft, setInternalDraft] = React.useState('')
  const [internalEditing, setInternalEditing] = React.useState(false)
  const [noteSaving, setNoteSaving] = React.useState(false)
  const [moreTimeOpen, setMoreTimeOpen] = React.useState(false)
  const [extensionConfirmOpen, setExtensionConfirmOpen] = React.useState(false)
  const [extensionLoading, setExtensionLoading] = React.useState(false)
  const [acceptConfirmOpen, setAcceptConfirmOpen] = React.useState(false)
  const [declineModalOpen, setDeclineModalOpen] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      setNote('')
      setLocalError(null)
    }
  }, [isOpen, detail?.id])

  React.useEffect(() => {
    if (detail?.internalNotes != null) {
      setInternalDraft(detail.internalNotes)
    } else {
      setInternalDraft('')
    }
    setInternalEditing(false)
  }, [detail?.id, detail?.internalNotes])

  const currency = detail?.currency ?? 'CHF'
  const bannerVariant =
    detail?.status === 'request' && detail.expiresAt
      ? providerRequestBannerVariant(detail.expiresAt)
      : 'calm'

  const dropoffPickup = detail?.session
    ? formatDropoffPickupLabels(
        detail.session.startDate,
        detail.session.endDate,
        detail.session.arrivalTime,
        detail.session.departureTime,
        detail.session.sessionDayType
      )
    : null

  const openMessages = () => {
    if (!detail) return
    if (detail.messaging.conversationId) {
      setActiveConversation(detail.messaging.conversationId)
    }
    router.push('/messages')
    onOpenChange(false)
  }

  const saveInternalNotes = async (value: string | null) => {
    if (!detail) return
    setNoteSaving(true)
    const res = await providerBookingGroupsService.patch(detail.id, { internalNotes: value })
    setNoteSaving(false)
    if (!res.success) {
      addToast({ title: 'Could not save note', color: 'danger' })
      return
    }
    addToast({ title: 'Note saved', color: 'success' })
    setInternalEditing(false)
    onDetailRefresh?.()
  }

  const requestExtensionFlow = async () => {
    if (!detail) return
    setExtensionLoading(true)
    const res = await providerBookingGroupsService.requestExtension(detail.id)
    setExtensionLoading(false)
    setMoreTimeOpen(false)
    if (!res.success) {
      addToast({ title: 'Could not extend deadline', color: 'danger' })
      return
    }
    setExtensionConfirmOpen(true)
    onDetailRefresh?.()
  }

  const renderStatusBanner = () => {
    if (!detail) return null
    const amount = formatCurrency(detail.totalAmount, currency)

    const bannerBase = 'flex items-center justify-between border-b border-gray-200 px-6 py-3.5'

    if (detail.status === 'request') {
      const exp = detail.expiresAt ? new Date(detail.expiresAt) : null
      const ms = exp ? exp.getTime() - Date.now() : null
      const hoursLeft = ms != null && ms > 0 ? Math.max(1, Math.floor(ms / 3600000)) : 0

      if (bannerVariant === 'calm') {
        const sub =
          hoursLeft > 24
            ? `Respond within ${Math.ceil(hoursLeft / 24)} days`
            : detail.expiresAt
              ? `Respond by ${formatMediumDate(detail.expiresAt)}`
              : 'Respond when you can'
        return (
          <div className={cn(bannerBase, 'bg-primary-50')}>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-sm font-semibold text-secondary-500">New request</div>
                <div className="text-sm text-gray-500">{sub}</div>
              </div>
            </div>
            <div className="text-lg font-bold text-secondary-500">{amount}</div>
          </div>
        )
      }

      if (bannerVariant === 'warning') {
        return (
          <div className={cn(bannerBase, 'bg-warning-50')}>
            <div className="flex items-center gap-3">
              <div className="size-2 shrink-0 animate-pulse rounded-full bg-warning-500" />
              <div>
                <div className="text-sm font-semibold text-secondary-500">
                  {hoursLeft > 0 ? `Expires in ${hoursLeft} hours` : 'Expires soon'}
                </div>
                <div className="text-sm text-gray-500">Request expires if not accepted</div>
              </div>
            </div>
            <div className="text-lg font-bold text-secondary-500">{amount}</div>
          </div>
        )
      }

      return (
        <div className={cn(bannerBase, 'bg-danger-50')}>
          <div className="flex items-center gap-3">
            <div className="size-2 shrink-0 rounded-full bg-danger-500" />
            <div>
              <div className="text-sm font-semibold text-secondary-500">
                {hoursLeft > 0 ? `Auto-declines in ${hoursLeft} hours` : 'Expires soon'}
              </div>
              <div className="text-sm text-gray-500">Request expires if not accepted</div>
            </div>
          </div>
          <div className="text-lg font-bold text-secondary-500">{amount}</div>
        </div>
      )
    }

    if (
      detail.status === 'accepted' ||
      detail.status === 'deposit_paid' ||
      detail.status === 'fully_paid'
    ) {
      const d = daysUntil(detail.session.startDate)
      const sub =
        detail.status === 'deposit_paid'
          ? 'Balance may be due · see payout schedule (coming soon)'
          : detail.status === 'fully_paid'
            ? 'All set for arrival'
            : 'Awaiting payment steps'
      const isPaid = detail.status === 'fully_paid'
      return (
        <div className={cn(bannerBase, isPaid ? 'bg-success-50' : 'bg-warning-50')}>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'size-2 shrink-0 rounded-full',
                isPaid ? 'bg-success-500' : 'bg-warning-500 animate-pulse'
              )}
            />
            <div>
              <div className="text-sm font-semibold text-secondary-500">
                {d > 0 ? `Arriving in ${d} days` : 'Session started'}
              </div>
              <div className="text-sm text-gray-500">{sub}</div>
            </div>
          </div>
          <div className="text-lg font-bold text-secondary-500">{amount}</div>
        </div>
      )
    }

    if (detail.status === 'at_camp') {
      return (
        <div className={cn(bannerBase, 'bg-success-50')}>
          <div className="flex items-center gap-3">
            <div className="size-2 shrink-0 rounded-full bg-success-500" />
            <div>
              <div className="text-sm font-semibold text-secondary-500">Camp in progress</div>
              <div className="text-sm text-gray-500">
                Check-out {formatMediumDate(detail.session.endDate)}
              </div>
            </div>
          </div>
          <div className="text-lg font-bold text-secondary-500">{amount}</div>
        </div>
      )
    }

    if (detail.status === 'completed') {
      return (
        <div className={cn(bannerBase, 'bg-gray-100')}>
          <div className="flex items-center gap-3">
            <div className="size-2 shrink-0 rounded-full bg-gray-400" />
            <div>
              <div className="text-sm font-semibold text-secondary-500">
                Completed {formatMediumDate(detail.session.endDate)}
              </div>
              <div className="text-sm text-gray-500">Thank you for hosting</div>
            </div>
          </div>
          <div className="text-lg font-bold text-secondary-500">{amount}</div>
        </div>
      )
    }

    if (detail.status === 'cancelled') {
      return (
        <div className={cn(bannerBase, 'bg-gray-100')}>
          <div className="flex items-center gap-3">
            <div className="size-2 shrink-0 rounded-full bg-gray-400" />
            <div>
              <div className="text-sm font-semibold text-secondary-500">
                Cancelled {formatMediumDate(detail.updatedAt)}
              </div>
              <div className="text-sm text-gray-500">
                Refund details in World-Camps (placeholder)
              </div>
            </div>
          </div>
          <div className="text-lg font-bold text-secondary-500">
            {formatCurrency(detail.paidAmount, currency)}
          </div>
        </div>
      )
    }

    return (
      <div className={cn(bannerBase, 'bg-gray-100')}>
        <div className="flex items-center gap-3">
          <div className="size-2 shrink-0 rounded-full bg-gray-400" />
          <div>
            <div className="text-sm font-semibold text-secondary-500">
              {detail.status.replace(/_/g, ' ')}
            </div>
            <div className="text-sm text-gray-500">
              Updated {formatMediumDate(detail.updatedAt)}
            </div>
          </div>
        </div>
        <div className="text-lg font-bold text-secondary-500">{amount}</div>
      </div>
    )
  }

  const renderAboutSection = (d: ProviderBookingGroupDetail) => {
    const fn = firstName(d.parent.displayName)
    const loc = formatLocation(d.parent)
    const langs = d.parent.languages?.length ? d.parent.languages.join(', ') : null
    const nat = [d.parent.primaryNationality, d.parent.secondaryNationality]
      .filter(Boolean)
      .join(' · ')
    const notSpecified = 'Not Specified'

    const { averageRating: avg, reviewsCount, completedBookingGroupsCount } = d.parentStats
    let ratingInner: React.ReactNode
    if (avg != null && reviewsCount != null && reviewsCount > 0) {
      ratingInner = (
        <span className="cursor-default underline underline-offset-2">
          {`${Number(avg).toFixed(1)} rating from ${reviewsCount} reviews`}
        </span>
      )
    } else if (avg != null) {
      ratingInner = (
        <span className="cursor-default underline underline-offset-2">
          {`${Number(avg).toFixed(1)} rating`}
        </span>
      )
    } else {
      ratingInner = <span>No ratings</span>
    }

    const locationLine = loc ? `Lives in ${loc}` : notSpecified
    const languagesLine = langs ? `Speaks ${langs}` : notSpecified
    const nationalityLine = nat || notSpecified
    const campsLine =
      typeof completedBookingGroupsCount === 'number'
        ? `Attended ${completedBookingGroupsCount} camp${completedBookingGroupsCount === 1 ? '' : 's'}`
        : notSpecified

    return (
      <div className="border-b border-gray-200 px-6 py-6 last:border-b-0">
        <div className="mb-4 text-lg font-semibold text-secondary-500">About {fn}</div>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3 text-secondary-500">
            <Star className="size-5" aria-hidden />
            {ratingInner}
          </div>
          <div className="flex items-center gap-3 text-secondary-500">
            <Globe className="size-5" aria-hidden />
            <span>{nationalityLine}</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-500">
            <MapPin className="size-5" aria-hidden />
            <span>{locationLine}</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-500">
            <Languages className="size-5" aria-hidden />
            <span>{languagesLine}</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-500">
            <Calendar className="size-5" aria-hidden />
            <span>{campsLine}</span>
          </div>
        </div>
      </div>
    )
  }

  const privateNoteLabel = (
    <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Private note
    </div>
  )

  const renderPrivateNote = (d: ProviderBookingGroupDetail) => {
    const saved = d.internalNotes?.trim()
    if (saved && !internalEditing) {
      return (
        <div className="border-t border-gray-200 px-6 py-6">
          {privateNoteLabel}
          <div className="rounded-lg bg-gray-100 px-3.5 py-3 text-sm leading-normal text-secondary-500">
            {saved}
          </div>
          <div className="mt-2.5 flex gap-4">
            <Button
              variant="light"
              size="sm"
              className="h-auto min-h-0 bg-transparent p-0 text-sm text-gray-500 underline underline-offset-2"
              onPress={() => setInternalEditing(true)}
            >
              Edit
            </Button>
            <Button
              variant="light"
              size="sm"
              className="h-auto min-h-0 bg-transparent p-0 text-sm text-danger underline underline-offset-2"
              onPress={() => void saveInternalNotes(null)}
            >
              Delete
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="border-t border-gray-200 px-6 py-6">
        {privateNoteLabel}
        <Textarea
          placeholder="Add a note only you can see..."
          value={internalDraft}
          onValueChange={setInternalDraft}
          minRows={3}
          classNames={{
            base: 'w-full',
            inputWrapper:
              'rounded-lg border border-gray-200 bg-white shadow-none hover:border-gray-200',
            input: 'text-sm text-secondary-500',
          }}
        />
        <Button
          variant="bordered"
          size="sm"
          className="mt-3 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:border-secondary-500 hover:text-secondary-500"
          isDisabled={noteSaving}
          onPress={() => void saveInternalNotes(internalDraft.trim() || null)}
        >
          {noteSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    )
  }

  const renderFooter = () => {
    if (!detail || loading || error) return null

    const footerShell = 'border-t border-gray-200 bg-white px-6 py-4'

    if (detail.status === 'request') {
      return (
        <DrawerFooter className={cn(footerShell, 'p-0')}>
          <div className="px-6 pt-4">
            <Textarea
              label="Note to parent (optional)"
              labelPlacement="outside"
              minRows={2}
              value={note}
              onValueChange={setNote}
              placeholder="Visible on the booking after you respond"
              classNames={{
                label: 'text-sm text-gray-500',
                inputWrapper: 'rounded-lg border border-gray-200 bg-white shadow-none',
                input: 'text-secondary-500',
              }}
            />
          </div>
          <div className="p-4">
            <Button
              fullWidth
              radius="md"
              className="w-full rounded-lg bg-primary-200 py-3.5 text-base font-semibold text-secondary-500 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
              isDisabled={actionLoading}
              isLoading={actionLoading}
              onPress={() => {
                setLocalError(null)
                setAcceptConfirmOpen(true)
              }}
            >
              Accept
            </Button>
            <div className="mt-2 flex gap-2">
              <Button
                variant="bordered"
                color="danger"
                radius="md"
                className="flex-1 rounded-lg border border-danger-200 bg-white py-2.5 text-sm font-medium text-danger"
                isDisabled={actionLoading}
                onPress={() => {
                  setLocalError(null)
                  setDeclineModalOpen(true)
                }}
              >
                Decline
              </Button>
              <Button
                variant="bordered"
                radius="md"
                className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-500 hover:border-secondary-500 hover:text-secondary-500"
                isDisabled={actionLoading || extensionLoading}
                onPress={() => setMoreTimeOpen(true)}
              >
                Need more time?
              </Button>
            </div>
            {localError ? (
              <p className="mt-2 text-center text-sm text-danger">{localError}</p>
            ) : null}
          </div>
        </DrawerFooter>
      )
    }

    if (detail.status === 'completed') {
      return (
        <DrawerFooter className={footerShell}>
          <Button
            fullWidth
            radius="md"
            className="w-full rounded-lg bg-primary-200 py-3.5 text-base font-semibold text-secondary-500 disabled:opacity-50"
            isDisabled
          >
            Request review
          </Button>
        </DrawerFooter>
      )
    }

    if (detail.status === 'cancelled') {
      return (
        <DrawerFooter className={footerShell}>
          <Button
            fullWidth
            radius="md"
            className="w-full rounded-lg bg-primary-200 py-3.5 text-base font-semibold text-secondary-500 hover:bg-primary-300"
            onPress={openMessages}
          >
            Message
          </Button>
        </DrawerFooter>
      )
    }

    return (
      <DrawerFooter className={footerShell}>
        <Button
          fullWidth
          radius="md"
          className="w-full rounded-lg bg-primary-200 py-3.5 text-base font-semibold text-secondary-500 hover:bg-primary-300"
          onPress={openMessages}
        >
          Message
        </Button>
      </DrawerFooter>
    )
  }

  const headerActionDisabled =
    detail &&
    (headerActionLabel(detail.status) === 'Export' ||
      headerActionLabel(detail.status) === 'Emergency' ||
      headerActionLabel(detail.status) === 'Download invoice')

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="right"
      scrollBehavior="inside"
      classNames={{
        base: 'sm:max-w-lg bg-white text-secondary-500',
        wrapper: 'z-50',
        body: 'p-0',
        header: 'p-0',
        footer: 'p-0',
      }}
    >
      <DrawerContent className="flex h-full max-h-dvh flex-col font-sans leading-normal">
        <>
          <DrawerHeader>
            <div className="flex w-full items-center gap-4 border-b border-gray-200 p-6">
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-secondary-500">
                  {detail ? statusPanelTitle(detail.status) : 'Booking'}
                </div>
                {detail ? (
                  <div className="mt-0.5 text-sm text-gray-500">
                    {detail.session.name} · {detail.camp.name}
                  </div>
                ) : (
                  <div className="mt-0.5 text-sm text-gray-500">—</div>
                )}
              </div>
              <Button
                variant="bordered"
                color="secondary"
                size="sm"
                className="mr-2"
                isDisabled={!detail || !!headerActionDisabled}
                title={headerActionDisabled ? 'Coming soon' : undefined}
                onPress={() => {
                  if (!detail || headerActionDisabled) return
                  if (headerActionLabel(detail.status) === 'Message') {
                    openMessages()
                  }
                }}
              >
                {detail ? headerActionLabel(detail.status) : 'Message'}
              </Button>
            </div>
          </DrawerHeader>

          <DrawerBody className="flex flex-col p-0">
            {loading && (
              <div className="flex justify-center py-16">
                <Spinner size="lg" label="Loading details" />
              </div>
            )}

            {!loading && error && (
              <div className="m-4 rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger">
                <p className="font-medium">{error}</p>
                <Button variant="flat" size="sm" className="mt-3" onPress={onRetry}>
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && detail && (
              <div className="flex flex-1 flex-col overflow-y-auto">
                {renderStatusBanner()}

                <div className="border-b border-gray-200 px-6 py-6">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 text-lg font-semibold text-secondary-500">
                        {detail.parent.displayName}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-normal text-gray-500">
                        {detail.parent.bio?.trim() || ''}
                      </div>
                    </div>
                    <Avatar
                      src={detail.parent.profilePhotoUrl ?? undefined}
                      name={firstName(detail.parent.displayName)}
                      classNames={{
                        base: 'h-16 w-16 shrink-0 border-2 border-gray-200 bg-indigo-100',
                        img: 'object-cover',
                      }}
                      showFallback
                    />
                  </div>
                </div>

                <Divider className="bg-gray-200" />

                {renderAboutSection(detail)}

                <Divider className="bg-gray-200" />

                <div className="border-b border-gray-200 px-6 py-6">
                  <div className="mb-4 text-base font-semibold text-secondary-500">
                    Children{' '}
                    <span className="text-sm font-normal text-gray-400">(age at check-in)</span>
                  </div>
                  {detail.bookings.map(b => {
                    const age = ageFromDateOfBirth(b.child.dateOfBirth)
                    const ageStr = age != null ? `${age} years old` : '—'
                    const gender = b.child.gender ? b.child.gender : '—'
                    return (
                      <Card
                        key={b.id}
                        shadow="none"
                        className="mb-3 rounded-xl border border-gray-200 bg-white last:mb-0"
                      >
                        <CardBody className="gap-0 p-4">
                          <p className="mb-2 text-xs text-gray-400">{b.bookingNumber}</p>
                          <div className="mb-1 text-base font-semibold text-secondary-500">
                            {b.child.firstName}
                            {b.child.lastName ? ` ${b.child.lastName}` : ''}
                          </div>
                          <div className="mb-3 text-sm font-medium text-secondary-500">
                            {ageStr} · {gender} · Booked by: parent
                          </div>
                          {b.child.schoolCountry ||
                          b.child.languages.length > 0 ||
                          b.addOns.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {b.child.schoolCountry ? (
                                <div className="flex justify-between py-2 text-sm">
                                  <span className="text-gray-500">Nationality</span>
                                  <span className="font-medium text-secondary-500">
                                    {b.child.schoolCountry}
                                  </span>
                                </div>
                              ) : null}
                              {b.child.languages.length > 0 ? (
                                <div className="flex justify-between py-2 text-sm">
                                  <span className="text-gray-500">Languages</span>
                                  <span className="font-medium text-secondary-500">
                                    {b.child.languages.join(', ')}
                                  </span>
                                </div>
                              ) : null}
                              {b.addOns.length > 0 ? (
                                <div className="flex justify-between py-2 text-sm">
                                  <span className="text-gray-500">Add-ons</span>
                                  <span className="font-medium text-secondary-500">
                                    {b.addOns.map(a => a.name).join(', ')}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {b.child.interestLabels.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {b.child.interestLabels.map(label => (
                                <Chip
                                  key={label}
                                  size="sm"
                                  variant="bordered"
                                  classNames={{
                                    base: 'border-gray-200 bg-gray-50 text-secondary-500',
                                  }}
                                >
                                  {label}
                                </Chip>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm">
                            <span className="text-gray-500">Line total</span>
                            <span className="font-medium text-secondary-500">
                              {formatCurrency(b.totalPrice, currency)}
                            </span>
                          </div>
                          {b.providerNote ? (
                            <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-600">Your note: </span>
                              {b.providerNote}
                            </p>
                          ) : null}
                        </CardBody>
                      </Card>
                    )
                  })}
                </div>

                <Divider className="bg-gray-200" />

                <div className="border-b border-gray-200 p-0">
                  <div className="rounded-none bg-gray-50 p-5">
                    <div className="mb-1 text-base font-semibold text-secondary-500">
                      {detail.session.name}
                    </div>
                    <div className="mb-4 text-sm text-gray-500">
                      {formatSessionRange(
                        detail.session.startDate,
                        detail.session.endDate,
                        detail.session.name
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-0.5 text-xs text-gray-400">Duration</div>
                        <div className="text-sm font-medium text-secondary-500">
                          {detail.session.durationWeeks != null
                            ? `${detail.session.durationWeeks} weeks`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5 text-xs text-gray-400">Check-in</div>
                        <div className="text-sm font-medium text-secondary-500">
                          {detail.session.arrivalTime ?? '—'}
                        </div>
                      </div>
                      {detail.status === 'request' ? (
                        <>
                          <div>
                            <div className="mb-0.5 text-xs text-gray-400">Age group</div>
                            <div className="text-sm font-medium text-secondary-500">
                              {detail.session.ageRangeLabel ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="mb-0.5 text-xs text-gray-400">Spots left</div>
                            <div className="text-sm font-medium text-secondary-500">
                              {detail.session.spotsRemaining != null
                                ? `${detail.session.spotsRemaining} available`
                                : '—'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="mb-0.5 text-xs text-gray-400">Check-out</div>
                            <div className="text-sm font-medium text-secondary-500">
                              {detail.session.departureTime ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="mb-0.5 text-xs text-gray-400">Age group</div>
                            <div className="text-sm font-medium text-secondary-500">
                              {detail.session.ageRangeLabel ?? '—'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {dropoffPickup ? (
                      <p className="mt-3 text-xs text-gray-400">
                        Check-in {dropoffPickup.dropoffDate}
                        {dropoffPickup.dropoffTime ? ` · ${dropoffPickup.dropoffTime}` : ''} ·
                        Check-out {dropoffPickup.pickupDate}
                        {dropoffPickup.pickupTime ? ` · ${dropoffPickup.pickupTime}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="border-b border-gray-200 px-6 py-6">
                  <div className="mb-4 text-base font-semibold text-secondary-500">
                    {detail.status === 'request' ? 'Potential earnings' : 'Your earnings'}
                  </div>
                  {detail.bookings.map(b => {
                    const age = ageFromDateOfBirth(b.child.dateOfBirth)
                    const w = detail.session.durationWeeks ?? 1
                    const lineSub = b.basePrice + b.addOns.reduce((sum, a) => sum + a.lineTotal, 0)
                    return (
                      <div
                        key={b.id}
                        className="flex justify-between py-2 text-sm text-secondary-500"
                      >
                        <span>
                          {b.child.firstName}
                          {age != null ? ` (${age})` : ''} × {w} week{w === 1 ? '' : 's'}
                        </span>
                        <span>{formatCurrency(lineSub, currency)}</span>
                      </div>
                    )
                  })}
                  {detail.discountTotal > 0 ? (
                    <div className="flex justify-between py-2 text-sm text-success-600">
                      <span>Discounts</span>
                      <span>−{formatCurrency(detail.discountTotal, currency)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between py-2 text-sm text-gray-500">
                    <span>Service fee (if applicable)</span>
                    <span>—</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t-2 border-secondary-500 pt-3 text-base font-semibold text-secondary-500">
                    <span>Total</span>
                    <span>{formatCurrency(detail.totalAmount, currency)}</span>
                  </div>
                  {detail.depositAmount != null && detail.depositAmount > 0 ? (
                    <div className="mt-2 flex justify-between text-xs text-gray-400">
                      <span>Deposit (reference)</span>
                      <span>{formatCurrency(detail.depositAmount, currency)}</span>
                    </div>
                  ) : null}
                </div>

                {detail.specialRequest?.trim() ? (
                  <>
                    <Divider className="bg-gray-200" />
                    <div className="border-b border-gray-200 px-6 py-6">
                      <div className="mb-4 text-base font-semibold text-secondary-500">
                        Special request
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-sm italic leading-relaxed text-gray-500">
                          &ldquo;{detail.specialRequest.trim()}&rdquo;
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}

                {detail.status === 'request' ? (
                  <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
                    <Button
                      variant="bordered"
                      radius="md"
                      className="flex-1 rounded-lg border-secondary-500 bg-white py-3 text-center text-sm font-medium text-secondary-500"
                      isDisabled
                    >
                      Send custom quote
                    </Button>
                    <Button
                      variant="bordered"
                      radius="md"
                      className="flex-1 rounded-lg border-secondary-500 bg-white py-3 text-center text-sm font-medium text-secondary-500"
                      isDisabled
                    >
                      Move to waitlist
                    </Button>
                  </div>
                ) : null}

                {['accepted', 'deposit_paid', 'fully_paid', 'at_camp'].includes(detail.status) ? (
                  <div className="border-t border-gray-200">
                    <Button
                      fullWidth
                      variant="light"
                      radius="none"
                      className="flex h-auto min-h-0 justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50"
                      endContent={<span className="text-lg text-gray-400">›</span>}
                    >
                      <span className="text-sm font-medium text-secondary-500">Request forms</span>
                    </Button>
                    <Button
                      fullWidth
                      variant="light"
                      radius="none"
                      className="flex h-auto min-h-0 justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50"
                      endContent={<span className="text-lg text-gray-400">›</span>}
                    >
                      <span className="text-sm font-medium text-secondary-500">
                        Transfer session
                      </span>
                    </Button>
                    <Button
                      fullWidth
                      variant="light"
                      radius="none"
                      className="flex h-auto min-h-0 justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50"
                      endContent={<span className="text-lg text-gray-400">›</span>}
                    >
                      <span className="text-sm font-medium text-secondary-500">
                        Download booking confirmation
                      </span>
                    </Button>
                    {detail.status !== 'deposit_paid' ? (
                      <Button
                        fullWidth
                        variant="light"
                        radius="none"
                        className="flex h-auto min-h-0 justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50"
                        endContent={<span className="text-lg text-gray-400">›</span>}
                      >
                        <span className="text-sm font-medium text-secondary-500">
                          Download invoice & statement
                        </span>
                      </Button>
                    ) : null}
                    <Button
                      fullWidth
                      variant="light"
                      color="danger"
                      radius="none"
                      className="flex h-auto min-h-0 justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50"
                      endContent={<span className="text-lg text-gray-400">›</span>}
                    >
                      <span className="text-sm font-medium text-danger">Cancel booking</span>
                    </Button>
                  </div>
                ) : null}

                {renderPrivateNote(detail)}

                <div className="flex gap-6 border-t border-gray-200 px-6 py-5">
                  <Button
                    as={Link}
                    href="/support/tickets/new"
                    variant="light"
                    size="sm"
                    className="h-auto min-h-0 px-0 text-sm font-normal text-gray-500 underline underline-offset-2"
                  >
                    Report this family
                  </Button>
                  <Button
                    as={Link}
                    href="/help"
                    variant="light"
                    size="sm"
                    className="h-auto min-h-0 px-0 text-sm font-normal text-gray-500 underline underline-offset-2"
                  >
                    Get help
                  </Button>
                </div>

                <div className="px-6 py-4 text-center text-xs text-gray-400">
                  Booking ID: {detail.bookingGroupNumber}
                </div>
              </div>
            )}
          </DrawerBody>

          {renderFooter()}

          <Modal isOpen={moreTimeOpen} onOpenChange={setMoreTimeOpen} placement="center">
            <ModalContent className="text-secondary-500">
              <ModalHeader className="flex flex-col gap-1 border-b border-gray-200 px-7 pb-5 pt-7">
                <span className="text-3xl">⏳</span>
                <span className="text-lg font-bold text-secondary-500">Need more time?</span>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-normal text-gray-500">
                  Requesting an extension gives you another{' '}
                  <strong className="text-secondary-500">24 hours</strong>. The family will be
                  notified when we add that workflow; your deadline is extended now.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => setMoreTimeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={extensionLoading}
                  onPress={() => void requestExtensionFlow()}
                >
                  Request extension
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            isOpen={extensionConfirmOpen}
            onOpenChange={setExtensionConfirmOpen}
            placement="center"
          >
            <ModalContent className="text-secondary-500">
              <ModalBody className="py-8 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary-200 text-2xl text-secondary-500">
                  ✓
                </div>
                <p className="mb-2 text-lg font-bold text-secondary-500">Extension granted</p>
                <p className="text-sm leading-normal text-gray-500">
                  You have more time to respond to this request.
                </p>
              </ModalBody>
              <ModalFooter className="justify-center">
                <Button color="primary" onPress={() => setExtensionConfirmOpen(false)}>
                  OK
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {detail && (
            <AcceptBookingConfirmationModal
              isOpen={acceptConfirmOpen}
              onClose={() => setAcceptConfirmOpen(false)}
              isLoading={actionLoading}
              detail={detail}
              onConfirm={async () => {
                const r = await onAccept(note.trim())
                if (r.ok) {
                  setAcceptConfirmOpen(false)
                } else {
                  setLocalError(r.message ?? 'Could not accept')
                }
              }}
            />
          )}

          <DeclineBookingModal
            isOpen={declineModalOpen}
            onClose={() => setDeclineModalOpen(false)}
            isLoading={actionLoading}
            onConfirm={async payload => {
              const r = await onDecline({ ...payload, providerNote: note.trim() })
              if (r.ok) {
                setDeclineModalOpen(false)
              } else {
                setLocalError(r.message ?? 'Could not decline')
              }
            }}
          />
        </>
      </DrawerContent>
    </Drawer>
  )
}
