'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { MessageCircle, Phone } from 'lucide-react'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

interface EmergencyContactCardProps {
  booking: ParentBookingGroupSummary
}

export function EmergencyContactCard({ booking }: EmergencyContactCardProps) {
  return (
    <div className="mb-8 rounded-3xl border border-default-200 bg-background p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <Phone size={20} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Need to reach the camp?</h3>
      </div>
      <p className="mb-5 text-sm text-default-500">
        Send a message to {booking.camp.name} or open the booking for full provider contact details.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          as={Link}
          href="/messages"
          color="secondary"
          radius="lg"
          startContent={<MessageCircle size={18} />}
        >
          Message camp
        </Button>
        <Button as={Link} href={`/bookings/${booking.id}`} variant="bordered" radius="lg">
          View booking details
        </Button>
      </div>
    </div>
  )
}
