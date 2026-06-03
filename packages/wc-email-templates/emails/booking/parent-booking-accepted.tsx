import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingAcceptedProps {
  /** Salutation style — `'hi'` standard, `'dear'` formal. Passed in from
   *  the catalog entry so per-template overrides are explicit. */
  salutation: SalutationStyle
  /** Recipient first name. Optional; renders fallback when missing. */
  firstName?: string | null
  childName: string
  campName: string
  programName: string
  /** Pre-formatted session start date (e.g. "12 July 2026"). */
  startDate: string
  /** Booking reference (BookingGroup.bookingGroupNumber). */
  bookingRef: string
  /** Pre-formatted deposit amount (e.g. "$500.00"). */
  depositPaid: string
  /** Pre-formatted balance amount. */
  balanceAmount: string
  /** Pre-formatted balance due date. */
  balanceDueDate: string
  /** Deep link to the booking detail page on wc-booking. */
  bookingUrl: string
}

/**
 * Parent — Booking confirmed.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Parents" #2 (Booking Confirmed).
 * Tone: warm, celebratory, anchored on the named child.
 */
export default function ParentBookingAccepted({
  salutation,
  firstName,
  childName,
  campName,
  programName,
  startDate,
  bookingRef,
  depositPaid,
  balanceAmount,
  balanceDueDate,
  bookingUrl,
}: ParentBookingAcceptedProps) {
  return (
    <Layout preview={`Your booking at ${campName} is confirmed — ${childName} is in!`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>You&apos;re all confirmed — how exciting!</Heading>

      <Text style={paragraphStyle}>
        Your booking for {childName} at {campName} is officially confirmed. Here&apos;s everything
        you need to know:
      </Text>

      <InfoPanel>
        <Text style={detailLine}>
          <strong>Program:</strong> {programName}
        </Text>
        <Text style={detailLine}>
          <strong>Start date:</strong> {startDate}
        </Text>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Deposit paid:</strong> {depositPaid}
        </Text>
        <Text style={detailLine}>
          <strong>Balance of {balanceAmount}</strong> will be charged automatically on{' '}
          {balanceDueDate}.
        </Text>
      </InfoPanel>

      <Text style={paragraphStyle}>
        The camp will be in touch with any preparation notes ahead of the program. In the meantime,
        you can view your full booking details, manage your payment, and message the camp directly
        from your dashboard.
      </Text>

      <BrandedButton href={bookingUrl}>View your booking</BrandedButton>

      <Text style={paragraphStyle}>
        If you need anything at all, simply reply to this email — we&apos;re here to make sure
        everything goes smoothly for your family.
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
  fontSize: '24px',
  fontWeight: 700,
  lineHeight: '32px',
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
  lineHeight: '24px',
  margin: '4px 0',
}

const signOffStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0 0',
}

/**
 * Preview props for the React Email previewer (`nx run wc-email-templates:email-dev`).
 * Adjacent to the default export per React Email convention.
 */
export const PreviewProps: ParentBookingAcceptedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  programName: 'Two-Week Mountain Discovery — Session 3',
  startDate: '12 July 2026',
  bookingRef: 'WC-2026-A8K3LM',
  depositPaid: '$650.00',
  balanceAmount: '$1,950.00',
  balanceDueDate: '12 May 2026',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
