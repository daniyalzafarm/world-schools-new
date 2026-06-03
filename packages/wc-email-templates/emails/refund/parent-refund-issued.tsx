import { Heading, Text } from '@react-email/components'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentRefundIssuedProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  bookingRef: string
  /** Pre-formatted refund amount (e.g. "$650.00"). */
  refundAmount: string
  /** Landing ETA copy — "5–10 business days" by default. */
  refundEta: string
  /** Optional reason copy to give context. */
  reasonLabel?: string | null
}

export default function ParentRefundIssued({
  salutation,
  firstName,
  campName,
  bookingRef,
  refundAmount,
  refundEta,
  reasonLabel,
}: ParentRefundIssuedProps) {
  return (
    <Layout preview={`Refund of ${refundAmount} processed`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Your refund has been processed.</Heading>
      <Text style={paragraphStyle}>
        A refund of <strong>{refundAmount}</strong> for your booking at {campName} has been issued
        and will appear on your statement within {refundEta}.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Refund:</strong> {refundAmount} · arrives within {refundEta}
        </Text>
        {reasonLabel ? (
          <Text style={detailLine}>
            <strong>Reason:</strong> {reasonLabel}
          </Text>
        ) : null}
      </InfoPanel>
      <Text style={paragraphStyle}>
        If the refund hasn&apos;t reached you within {refundEta}, just reply to this email and our
        team will trace it for you.
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

export const PreviewProps: ParentRefundIssuedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  refundAmount: '$650.00',
  refundEta: '5–10 business days',
  reasonLabel: 'Cancellation within grace period',
}
