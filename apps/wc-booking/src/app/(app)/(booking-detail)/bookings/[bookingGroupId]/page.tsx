'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Alert, Button, Spinner } from '@heroui/react'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { ParentBookingGroupDetail } from '@/types/camp-booking'
import { BookingDetailTopBar } from '@/components/bookings/booking-detail-top-bar'
import { BookingDetailSidebar } from '@/components/bookings/booking-detail-sidebar'
import { BookingDetailMapPanel } from '@/components/bookings/booking-detail-map-panel'

export default function BookingGroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookingGroupId = params?.bookingGroupId as string | undefined

  const [detail, setDetail] = useState<ParentBookingGroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookingGroupId) return
    setLoading(true)
    setError(null)
    const res = await bookingGroupsService.getById(bookingGroupId)
    if (res.success && res.data) {
      setDetail(res.data)
    } else {
      setDetail(null)
      setError((res.data as { message?: string })?.message ?? 'Could not load this booking.')
    }
    setLoading(false)
  }, [bookingGroupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (detail?.status !== 'draft') return
    const slug = detail.camp.slug
    router.replace(
      `/book/${encodeURIComponent(slug)}?bookingGroupId=${encodeURIComponent(detail.id)}`
    )
  }, [detail, router])

  if (!bookingGroupId) {
    return (
      <div className="p-6">
        <Alert color="danger" title="Missing booking" description="Invalid URL." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <Spinner size="lg" color="primary" label="Loading booking" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Alert
          color="danger"
          variant="flat"
          title="Something went wrong"
          description={error ?? 'Booking not found.'}
        />
        <Button variant="flat" onPress={() => void load()}>
          Retry
        </Button>
        <Button as={Link} href="/bookings" variant="light">
          Back to bookings
        </Button>
      </div>
    )
  }

  if (detail.status === 'draft') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <Spinner size="lg" color="primary" label="Opening draft…" />
      </div>
    )
  }

  const placeName = detail.camp.locationName || detail.camp.name

  return (
    <>
      <BookingDetailTopBar
        title={detail.camp.name}
        status={detail.status}
        bookingGroupNumber={detail.bookingGroupNumber}
      />
      {/* overflow-hidden + min-h-0: cap height so aside can scroll on mobile (shrink-0 was growing to content height). */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="min-h-0 w-full flex-1 overflow-y-auto overscroll-y-contain border-default-200 lg:max-w-md lg:w-[min(100%,28rem)] lg:flex-none lg:shrink-0 lg:border-r dark:border-slate-700">
          <BookingDetailSidebar detail={detail} onCancelled={() => void load()} />
        </aside>
        <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col">
          <BookingDetailMapPanel
            lat={detail.camp.locationLat}
            lng={detail.camp.locationLng}
            placeName={placeName}
            placeId={detail.camp.locationPlaceId}
          />
        </div>
      </div>
    </>
  )
}
