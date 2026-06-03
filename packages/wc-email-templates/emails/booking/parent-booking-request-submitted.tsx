import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingRequestSubmittedProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  programName: string
  /** Pre-formatted start date (e.g. "12 July 2026"). */
  startDate: string
  /** Booking reference. */
  bookingRef: string
  /** Deep link to the booking. */
  bookingUrl: string
}

/**
 * Parent — Booking request submitted.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Parents" #1 (Booking Request
 * Submitted). Fires on submit. Sets parent expectations on the 72h response
 * SLA.
 */
export default function ParentBookingRequestSubmitted({
  salutation,
  firstName,
  childName,
  campName,
  programName,
  startDate,
  bookingRef,
  bookingUrl,
}: ParentBookingRequestSubmittedProps) {
  return (
    <Layout preview={`Your booking request for ${campName} has been sent`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>Your booking request has been sent.</Heading>

      <Text style={paragraphStyle}>
        Your booking request for {childName} at {campName} — {programName} starting {startDate} —
        has been sent. The camp has <strong>72 hours</strong> to confirm. We&apos;ll notify you as
        soon as they respond.
      </Text>

      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
      </InfoPanel>

      <BrandedButton href={bookingUrl}>View your request</BrandedButton>

      <Text style={paragraphStyle}>
        If you have any questions about your request, simply reply to this email — we&apos;re always
        happy to help.
      </Text>

      <Text style={signOffStyle}>
        Warm regards,
        <br />
        The World Camps Team
      </Text>
    </Layout>
  )
}

const headingStyle = {
  color: theme.colors.textPrimary,
  fontSize: '22px',
  fontWeight: 700,
  lineHeight: '30px',
  margin: '0 0 16px 0',
}
const paragraphStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
}
const detailLine = {
  color: theme.colors.textPrimary,
  fontSize: '15px',
  lineHeight: '22px',
  margin: '4px 0',
}
const signOffStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0 0',
}

export const PreviewProps: ParentBookingRequestSubmittedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  programName: 'Two-Week Mountain Discovery — Session 3',
  startDate: '12 July 2026',
  bookingRef: 'WC-2026-A8K3LM',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
