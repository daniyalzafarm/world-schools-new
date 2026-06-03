import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentPaymentBalanceChargedProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  balanceAmount: string
  /** ISO date string of when the camp begins. */
  startDate: string
  bookingUrl: string
}

export default function ParentPaymentBalanceCharged({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  balanceAmount,
  startDate,
  bookingUrl,
}: ParentPaymentBalanceChargedProps) {
  return (
    <Layout preview={`Balance paid for ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Balance paid — you&apos;re all set!</Heading>
      <Text style={paragraphStyle}>
        Your balance of <strong>{balanceAmount}</strong> for {childName}&apos;s place at {campName}{' '}
        has been collected successfully.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Balance paid:</strong> {balanceAmount}
        </Text>
        <Text style={detailLine}>
          <strong>Program starts:</strong> {startDate}
        </Text>
      </InfoPanel>
      <Text style={paragraphStyle}>
        Nothing more to do on the payment front. Watch for any pre-camp notes from the camp team as
        the start date approaches.
      </Text>
      <BrandedButton href={bookingUrl}>View your booking</BrandedButton>
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

export const PreviewProps: ParentPaymentBalanceChargedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  balanceAmount: '$1,950.00',
  startDate: '12 July 2026',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
