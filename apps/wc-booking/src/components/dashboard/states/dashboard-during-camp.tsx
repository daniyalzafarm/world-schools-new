'use client'

import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { GreetingHeader } from '../greeting-header'
import { AtCampBanner } from '../at-camp-banner'
import { EmergencyContactCard } from '../emergency-contact-card'

interface DashboardDuringCampProps {
  booking: ParentBookingGroupSummary
}

export function DashboardDuringCamp({ booking }: DashboardDuringCampProps) {
  return (
    <>
      <GreetingHeader subtitle="Hope they're having an amazing time." />
      <AtCampBanner booking={booking} />
      <EmergencyContactCard booking={booking} />
    </>
  )
}
