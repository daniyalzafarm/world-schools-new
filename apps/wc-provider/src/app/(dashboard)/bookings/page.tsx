import { PageSlot } from '@/components/layout/page-slot'
import { BookingRequestsView } from '@/components/booking-requests/booking-requests-view'

export default function BookingRequestsPage() {
  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Booking requests</h1>
          <p className="text-default-600">
            Review and respond to parent booking requests for your camps.
          </p>
        </header>
        <BookingRequestsView />
      </section>
    </PageSlot>
  )
}
