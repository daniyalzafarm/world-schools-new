import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentPaymentDepositConfirmedProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  /** Pre-formatted deposit amount (e.g. "$650.00"). */
  depositAmount: string
  /** Pre-formatted balance amount due later. */
  balanceAmount: string
  /** Pre-formatted balance due date. */
  balanceDueDate: string
  bookingUrl: string
}

export default function ParentPaymentDepositConfirmed({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  depositAmount,
  balanceAmount,
  balanceDueDate,
  bookingUrl,
}: ParentPaymentDepositConfirmedProps) {
  return (
    <Layout preview={`Deposit received for ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Deposit received — thank you!</Heading>
      <Text style={paragraphStyle}>
        We&apos;ve received your deposit of <strong>{depositAmount}</strong> for {childName}&apos;s
        place at {campName}.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Deposit paid:</strong> {depositAmount}
        </Text>
        <Text style={detailLine}>
          <strong>Balance:</strong> {balanceAmount} due on {balanceDueDate}
        </Text>
      </InfoPanel>
      <Text style={paragraphStyle}>
        The balance will be charged automatically using the card on file. You can update your
        payment method any time from your booking page.
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

export const PreviewProps: ParentPaymentDepositConfirmedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  depositAmount: '$650.00',
  balanceAmount: '$1,950.00',
  balanceDueDate: '12 May 2026',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
