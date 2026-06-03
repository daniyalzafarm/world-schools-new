import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type SuperadminFinanceEventKind =
  | 'disputeFiled'
  | 'disputeResolved'
  | 'payoutFailure'
  | 'payoutRecoveryNeeded'
  | 'fundsPendingTransfer'
  | 'bookingCancelledNonPayment'

export interface SuperadminFinanceEventProps {
  companyName: string
  /** Pre-formatted booking reference. Optional for batch payout events. */
  bookingRef?: string | null
  /** Pre-formatted amount + currency (e.g. "$2,340.00"). */
  amount?: string | null
  /** Stripe-provided reason / failure detail. */
  reason?: string | null
  /** disputeResolved variant — 'won' or 'lost' or null. */
  outcome?: 'won' | 'lost' | null
  kind: SuperadminFinanceEventKind
  reviewUrl: string
}

const HEADINGS: Record<SuperadminFinanceEventKind, string> = {
  disputeFiled: 'Payment dispute received — review needed.',
  disputeResolved: 'Payment dispute resolved.',
  payoutFailure: 'Payout to camp could not be processed.',
  payoutRecoveryNeeded: 'Clawback cannot be resolved automatically.',
  fundsPendingTransfer: 'Payment received — payout pending.',
  bookingCancelledNonPayment: 'Booking auto-cancelled — non-payment.',
}

const BODIES: Record<SuperadminFinanceEventKind, (props: SuperadminFinanceEventProps) => string> = {
  disputeFiled: p =>
    `A chargeback has been filed on booking ${p.bookingRef ?? ''}${p.amount ? ` for ${p.amount}` : ''}. Stripe imposes hard response deadlines — please open the dispute and supply evidence quickly.`,
  disputeResolved: p =>
    `The payment dispute on booking ${p.bookingRef ?? ''} has been resolved${p.outcome ? ` in ${p.outcome === 'won' ? 'the platform’s' : 'the buyer’s'} favour` : ''}. No further action required.`,
  payoutFailure: p =>
    `A payout of ${p.amount ?? ''} to ${p.companyName} has failed${p.reason ? ` (${p.reason})` : ''}. Funds remain in the connected account; the provider may need to fix their Stripe payout configuration.`,
  payoutRecoveryNeeded: p =>
    `A refund clawback of ${p.amount ?? ''} is owed by ${p.companyName} for booking ${p.bookingRef ?? ''} but cannot be deducted from any upcoming payout. Manual recovery required.`,
  fundsPendingTransfer: p =>
    `A payment of ${p.amount ?? ''} has been received for booking ${p.bookingRef ?? ''} at ${p.companyName}. The payout has not yet been released to the camp.`,
  bookingCancelledNonPayment: p =>
    `Booking ${p.bookingRef ?? ''} at ${p.companyName} has been automatically cancelled after the balance-charge retries were exhausted. Informational — the deposit payout has already settled per policy.`,
}

export default function SuperadminFinanceEvent(props: SuperadminFinanceEventProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Camp:</strong> {props.companyName}
        </Text>
        {props.bookingRef ? (
          <Text style={detailLine}>
            <strong>Booking reference:</strong> {props.bookingRef}
          </Text>
        ) : null}
        {props.amount ? (
          <Text style={detailLine}>
            <strong>Amount:</strong> {props.amount}
          </Text>
        ) : null}
        {props.reason ? (
          <Text style={detailLine}>
            <strong>Reason:</strong> {props.reason}
          </Text>
        ) : null}
        {props.outcome ? (
          <Text style={detailLine}>
            <strong>Outcome:</strong> {props.outcome}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={props.reviewUrl}>Open in admin</BrandedButton>
      <Text style={signOffStyle}>World Camps Platform</Text>
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

export const PreviewProps: SuperadminFinanceEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  bookingRef: 'WC-2026-A8K3LM',
  amount: '$2,340.00',
  reason: 'insufficient_funds',
  outcome: 'won',
  kind: 'payoutFailure',
  reviewUrl: 'https://admin.worldcamps.com/bookings/WC-2026-A8K3LM',
}
