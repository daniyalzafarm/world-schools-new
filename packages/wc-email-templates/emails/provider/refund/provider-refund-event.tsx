import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type RefundEventKind = 'issued' | 'failed' | 'reimbursementOwed'

export interface ProviderRefundEventProps {
  companyName: string
  bookingRef: string
  amount: string
  /** Optional Stripe failure reason / reimbursement explanation. */
  reason?: string | null
  kind: RefundEventKind
  refundsUrl: string
}

const HEADINGS: Record<RefundEventKind, string> = {
  issued: 'Refund issued to family.',
  failed: 'Refund could not be processed.',
  reimbursementOwed: 'You owe a reimbursement to the platform.',
}

const BODIES: Record<RefundEventKind, (props: ProviderRefundEventProps) => string> = {
  issued: p =>
    `A refund of ${p.amount} was issued for booking ${p.bookingRef}.${p.reason ? ` Reason: ${p.reason}.` : ''} It is debited from your connected-account balance per Direct Charges.`,
  failed: p =>
    `Our payment processor was unable to complete a ${p.amount} refund for booking ${p.bookingRef}${p.reason ? ` (${p.reason})` : ''}. Our team is on it.`,
  reimbursementOwed: p =>
    `Because your transferDate had already passed when the refund was issued, the platform absorbed the ${p.amount} refund for booking ${p.bookingRef}. We'll invoice this reimbursement on your next billing cycle.`,
}

export default function ProviderRefundEvent(props: ProviderRefundEventProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {props.companyName}
        </Text>
        <Text style={detailLine}>
          <strong>Booking:</strong> {props.bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Amount:</strong> {props.amount}
        </Text>
      </InfoPanel>
      <BrandedButton href={props.refundsUrl}>View refund</BrandedButton>
      <Text style={signOffStyle}>The World Camps Team</Text>
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

export const PreviewProps: ProviderRefundEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  bookingRef: 'WC-2026-A8K3LM',
  amount: '$1,950.00',
  reason: 'Cancellation within 30-day tier',
  kind: 'issued',
  refundsUrl: 'https://provider.worldcamps.com/refunds',
}
