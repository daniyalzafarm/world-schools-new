import { Heading, Text } from '@react-email/components'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type DisputeOutcome = 'won' | 'lost'

export interface ParentDisputeResolvedProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  bookingRef: string
  disputeAmount: string
  outcome: DisputeOutcome
}

const HEADINGS: Record<DisputeOutcome, string> = {
  won: 'The dispute has closed in our favour.',
  lost: 'The dispute has been resolved in your favour.',
}

const BODIES: Record<DisputeOutcome, (amount: string, camp: string) => string> = {
  won: (amount, camp) =>
    `Your bank has closed the chargeback for ${amount} on your booking at ${camp} without a refund. The original charge stands. If you have any questions, please contact your bank.`,
  lost: (amount, camp) =>
    `Your bank has closed the chargeback for ${amount} on your booking at ${camp} and returned the funds to you. The booking is considered cancelled; if you&apos;d like to rebook please get in touch.`,
}

export default function ParentDisputeResolved({
  salutation,
  firstName,
  campName,
  bookingRef,
  disputeAmount,
  outcome,
}: ParentDisputeResolvedProps) {
  return (
    <Layout preview={`Chargeback resolved on ${campName} booking`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[outcome]}</Heading>
      <Text style={paragraphStyle}>{BODIES[outcome](disputeAmount, campName)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Disputed amount:</strong> {disputeAmount}
        </Text>
        <Text style={detailLine}>
          <strong>Outcome:</strong>{' '}
          {outcome === 'won' ? 'Resolved (charge stands)' : 'Resolved (refunded)'}
        </Text>
      </InfoPanel>
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

export const PreviewProps: ParentDisputeResolvedProps = {
  salutation: 'dear',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  disputeAmount: '$2,600.00',
  outcome: 'won',
}
