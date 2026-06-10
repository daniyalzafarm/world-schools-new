import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export interface ProviderBookingRequestReceivedProps {
  campName: string
  /** BookingGroup.bookingGroupNumber, e.g. "WC-2026-A8K3LM". */
  bookingGroupNumber: string
  /** ISO timestamp the 72h response window closes. */
  requestExpiresAt?: string
  /** Deep link to the booking in the provider portal. */
  bookingUrl: string
}

/**
 * Provider — New booking request received.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Providers" (Booking Request
 * Received). BUG-179: the in-app notification fired but no email did, so a camp
 * that isn't logged in could miss a request that auto-expires in 72 hours.
 */
export default function ProviderBookingRequestReceived({
  campName,
  bookingGroupNumber,
  requestExpiresAt,
  bookingUrl,
}: ProviderBookingRequestReceivedProps) {
  const respondBy = formatDeadline(requestExpiresAt)
  return (
    <Layout preview={`New booking request — ${campName}`}>
      <Salutation style="none" />
      <Heading style={headingStyle}>You have a new booking request for {campName}.</Heading>
      <Text style={paragraphStyle}>
        A family has requested to book a place. Please review and respond within the 72-hour window
        — if you don&apos;t respond in time the request auto-expires and the family is released to
        book elsewhere.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingGroupNumber}
        </Text>
        {respondBy ? (
          <Text style={detailLine}>
            <strong>Respond by:</strong> {respondBy}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={bookingUrl}>Review request</BrandedButton>
      <Text style={signOffStyle}>The World Camps Team</Text>
    </Layout>
  )
}

function formatDeadline(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

export const PreviewProps: ProviderBookingRequestReceivedProps = {
  campName: 'Alpine Adventure Camp',
  bookingGroupNumber: 'WC-2026-A8K3LM',
  requestExpiresAt: '2026-06-13T09:00:00.000Z',
  bookingUrl: 'https://provider.worldcamps.com/bookings/abc',
}
