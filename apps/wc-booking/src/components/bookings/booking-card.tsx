'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addToast, Button } from '@heroui/react'
import { useConfirmDialog } from '@world-schools/ui-web'
import {
  ageFromDateOfBirth,
  formatSessionRange,
  statusBadgeClass,
  statusLabel,
} from '@world-schools/wc-frontend-utils'
import { Trash2 } from 'lucide-react'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

export function BookingCard({
  row,
  onDraftDeleted,
}: {
  row: ParentBookingGroupSummary
  onDraftDeleted: () => void | Promise<void>
}) {
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [deleting, setDeleting] = useState(false)
  const cover = row.camp.coverImageUrl
  const isDraft = row.status === 'draft'
  const draftContinueHref = isDraft
    ? `/book/${encodeURIComponent(row.camp.slug)}?bookingGroupId=${encodeURIComponent(row.id)}`
    : null
  const detailHref = !isDraft ? `/bookings/${encodeURIComponent(row.id)}` : null

  const className =
    'flex flex-col overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm transition hover:border-default-300 hover:shadow-md sm:flex-row' +
    (isDraft || detailHref ? ' cursor-pointer' : '') +
    (row.status === 'completed' ? ' opacity-[0.85]' : '')

  const handleDeleteDraft = async () => {
    const ok = await confirm({
      title: 'Delete draft booking?',
      message:
        'This will remove your saved progress for this camp. You can start a new booking anytime.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await bookingGroupsService.deleteDraft(row.id)
      if (res.success) {
        addToast({ title: 'Draft deleted', color: 'success' })
        await onDraftDeleted()
      } else {
        const msg =
          typeof res.data === 'object' && res.data && 'message' in res.data
            ? String((res.data as { message?: string }).message)
            : 'Could not delete this draft.'
        addToast({ title: 'Could not delete', description: msg, color: 'danger' })
      }
    } finally {
      setDeleting(false)
    }
  }

  const inner = (
    <>
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-default-100 sm:h-auto sm:w-60 sm:min-h-36">
        {cover ? (
          <img
            src={cover}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover${row.status === 'cancelled' ? ' grayscale' : ''}`}
            loading="lazy"
          />
        ) : null}
        <span
          className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
        >
          {statusLabel(row.status)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="mb-0.5 font-mono text-xs text-default-500">{row.bookingGroupNumber}</p>
            <h3 className="text-lg font-semibold text-secondary">{row.camp.name}</h3>
          </div>
          {isDraft ? (
            <div
              className="shrink-0"
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              role="presentation"
            >
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isLoading={deleting}
                isDisabled={deleting}
                onPress={handleDeleteDraft}
                isIconOnly
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-default-600">
          {formatSessionRange(row.session.startDate, row.session.endDate, row.session.name)}
        </p>
        <div className="flex flex-wrap gap-2">
          {row.children.map(ch => {
            const age = ageFromDateOfBirth(ch.dateOfBirth)
            const initial = ch.firstName.charAt(0).toUpperCase()
            return (
              <div
                key={ch.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-3 py-1 text-sm text-default-800"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-rose-100 to-primary-100 text-xs font-semibold">
                  {initial}
                </span>
                {ch.firstName}
                {age !== null ? ` (${age})` : ''}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  if (draftContinueHref) {
    return (
      <div
        role="link"
        tabIndex={0}
        className={className}
        onClick={() => {
          if (deleting) return
          router.push(draftContinueHref)
        }}
        onKeyDown={e => {
          if (deleting) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(draftContinueHref)
          }
        }}
      >
        {inner}
      </div>
    )
  }

  if (detailHref) {
    return (
      <Link href={detailHref} className={className}>
        {inner}
      </Link>
    )
  }

  return <div className={className}>{inner}</div>
}
