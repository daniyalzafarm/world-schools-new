import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type BalanceFailureStage = 'first' | 'second' | 'final'

export interface ParentPaymentBalanceFailedProps {
  /** Spec `Notes & Conventions`: payment-failure copy uses 'Dear' salutation. */
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  balanceAmount: string
  /** Tier of failure — drives heading + body wording. */
  stage: BalanceFailureStage
  /** Stripe decline reason, displayed verbatim when present. */
  declineReason?: string | null
  /** Date by which the parent must update the card before the booking is
   *  cancelled (only meaningful for `first` / `second` stages). */
  retryDeadline?: string
  /** Deep link to /payment/update for the booking. */
  paymentUpdateUrl: string
}

const HEADINGS: Record<BalanceFailureStage, string> = {
  first: "We couldn't take your balance payment.",
  second: "Second attempt couldn't go through.",
  final: 'Final attempt failed — your booking is at risk.',
}

const BODIES: Record<BalanceFailureStage, string> = {
  first:
    "Don't worry — this happens, often a card expiry or a temporary issuer block. We'll try again in 24 hours.",
  second:
    "We tried again and your card still didn't go through. We'll make one more attempt — please update your payment method now to avoid cancellation.",
  final:
    "We've made all the attempts allowed and your card has still not been accepted. Without immediate action your booking will be cancelled.",
}

export default function ParentPaymentBalanceFailed({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  balanceAmount,
  stage,
  declineReason,
  retryDeadline,
  paymentUpdateUrl,
}: ParentPaymentBalanceFailedProps) {
  return (
    <Layout preview={`Payment issue with ${campName} booking`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage]}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Amount:</strong> {balanceAmount}
        </Text>
        <Text style={detailLine}>
          <strong>Child:</strong> {childName} · <strong>Camp:</strong> {campName}
        </Text>
        {declineReason ? (
          <Text style={detailLine}>
            <strong>Decline reason:</strong> {declineReason}
          </Text>
        ) : null}
        {retryDeadline && stage !== 'final' ? (
          <Text style={detailLine}>
            <strong>Update by:</strong> {retryDeadline}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={paymentUpdateUrl}>Update payment method</BrandedButton>
      <Text style={paragraphStyle}>
        If you&apos;d like help, simply reply to this email — our team is happy to walk you through
        the next steps.
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

export const PreviewProps: ParentPaymentBalanceFailedProps = {
  salutation: 'dear',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  balanceAmount: '$1,950.00',
  stage: 'first',
  declineReason: 'Card declined by issuer',
  retryDeadline: '24 May 2026',
  paymentUpdateUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM/payment/update',
}
