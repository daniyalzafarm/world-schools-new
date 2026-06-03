import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingModifiedProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  /** Short, human-readable summary of what changed (e.g. "Add-on(s) added"). */
  changesSummary: string
  bookingUrl: string
}

/**
 * Parent — Booking updated.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Parents" #7 (Booking
 * Modified). Fires when a confirmed booking has any meaningful change.
 */
export default function ParentBookingModified({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  changesSummary,
  bookingUrl,
}: ParentBookingModifiedProps) {
  return (
    <Layout preview={`Your booking at ${campName} has been updated`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>Your booking has been updated.</Heading>

      <Text style={paragraphStyle}>
        Your booking for {childName} at {campName} has been updated.
      </Text>

      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Changes:</strong> {changesSummary}
        </Text>
      </InfoPanel>

      <BrandedButton href={bookingUrl}>View updated booking</BrandedButton>

      <Text style={paragraphStyle}>
        If you have any questions about the changes, simply reply to this email.
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

export const PreviewProps: ParentBookingModifiedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  changesSummary: 'Add-on selections updated · 2 add-ons changed',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
