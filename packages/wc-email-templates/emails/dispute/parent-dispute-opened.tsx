import { Heading, Text } from '@react-email/components'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentDisputeOpenedProps {
  /** Spec: dispute copy uses formal 'Dear' salutation. */
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  bookingRef: string
  disputeAmount: string
}

export default function ParentDisputeOpened({
  salutation,
  firstName,
  campName,
  bookingRef,
  disputeAmount,
}: ParentDisputeOpenedProps) {
  return (
    <Layout preview={`Chargeback opened on ${campName} booking`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Your bank has opened a chargeback.</Heading>
      <Text style={paragraphStyle}>
        We&apos;ve been notified that your card-issuing bank has opened a chargeback for a{' '}
        <strong>{disputeAmount}</strong> charge linked to your booking at {campName}. The bank will
        lead the investigation; we&apos;ll work with them and the camp to provide the information
        they need.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Disputed amount:</strong> {disputeAmount}
        </Text>
      </InfoPanel>
      <Text style={paragraphStyle}>
        If this charge was not authorised, please contact your bank directly with any additional
        information. We&apos;ll keep you posted as the case develops.
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

export const PreviewProps: ParentDisputeOpenedProps = {
  salutation: 'dear',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  disputeAmount: '$2,600.00',
}
