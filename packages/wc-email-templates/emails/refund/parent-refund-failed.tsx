import { Heading, Text } from '@react-email/components'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentRefundFailedProps {
  /** Spec: refund-failure uses formal 'Dear' salutation. */
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  bookingRef: string
  refundAmount: string
  /** Stripe failure reason, displayed verbatim when present. */
  failureReason?: string | null
}

export default function ParentRefundFailed({
  salutation,
  firstName,
  campName,
  bookingRef,
  refundAmount,
  failureReason,
}: ParentRefundFailedProps) {
  return (
    <Layout preview={`Refund issue for ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>We hit a snag processing your refund.</Heading>
      <Text style={paragraphStyle}>
        Our payment processor was unable to complete your refund of <strong>{refundAmount}</strong>{' '}
        for {campName}. Our team has been alerted and will be in touch shortly with next steps.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Amount:</strong> {refundAmount}
        </Text>
        {failureReason ? (
          <Text style={detailLine}>
            <strong>Reason:</strong> {failureReason}
          </Text>
        ) : null}
      </InfoPanel>
      <Text style={paragraphStyle}>
        You don&apos;t need to do anything — we&apos;ll fix this on our end and follow up with you
        directly. If you have any questions, simply reply to this email.
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

export const PreviewProps: ParentRefundFailedProps = {
  salutation: 'dear',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  refundAmount: '$650.00',
  failureReason: 'Bank account closed',
}
