import { Heading, Text } from '@react-email/components'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingCancelledProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  /** Pre-formatted refund amount (e.g. "$650.00"). Empty string if no refund. */
  refundAmount: string
  /** Refund landing window from the spec — "5–10 business days" by default. */
  refundEta: string
}

/**
 * Parent — Cancellation confirmed.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Parents" #6 (Booking
 * Cancelled). Fires when the parent (or system) cancels a confirmed booking.
 * Always states the refund amount and ETA — prevents "where's my money?"
 * support tickets.
 */
export default function ParentBookingCancelled({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  refundAmount,
  refundEta,
}: ParentBookingCancelledProps) {
  return (
    <Layout preview={`Cancellation confirmed for ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>We&apos;re sorry to hear your plans have changed.</Heading>

      <Text style={paragraphStyle}>
        Your booking for {childName} at {campName} has been cancelled.
        {refundAmount
          ? ` A refund of ${refundAmount} has been processed and will appear on your statement within ${refundEta}.`
          : ' No refund is due under the cancellation policy that applied.'}
      </Text>

      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        {refundAmount ? (
          <Text style={detailLine}>
            <strong>Refund:</strong> {refundAmount} · arrives within {refundEta}
          </Text>
        ) : null}
      </InfoPanel>

      <Text style={paragraphStyle}>
        If you&apos;d like to explore other programs or have any questions, our team is here to help
        — just reply to this email.
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

export const PreviewProps: ParentBookingCancelledProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  refundAmount: '$650.00',
  refundEta: '5–10 business days',
}
