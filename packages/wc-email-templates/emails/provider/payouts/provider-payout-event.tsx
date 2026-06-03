import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type PayoutEventKind =
  | 'scheduleConfirmed'
  | 'balanceCollected'
  | 'reminder'
  | 'released'
  | 'failed'
  | 'delayed'

export interface ProviderPayoutEventProps {
  companyName: string
  /** Booking reference for booking-scoped events; empty for batch payout events. */
  bookingRef?: string | null
  /** Pre-formatted amount + currency (e.g. "$2,340.00"). */
  amount: string
  /** Pre-formatted release / expected date. */
  whenLabel?: string | null
  kind: PayoutEventKind
  /** Optional Stripe failure / delay reason. */
  reason?: string | null
  payoutsUrl: string
}

const HEADINGS: Record<PayoutEventKind, string> = {
  scheduleConfirmed: 'Payout schedule confirmed.',
  balanceCollected: 'Balance payment collected.',
  reminder: 'Upcoming payout reminder.',
  released: 'Payout released.',
  failed: 'Payout failed.',
  delayed: 'Payout delayed.',
}

const BODIES: Record<PayoutEventKind, (props: ProviderPayoutEventProps) => string> = {
  scheduleConfirmed: p =>
    `Payout schedule for booking ${p.bookingRef ?? ''} is now confirmed. Tranches release ${p.whenLabel ?? 'per your provider settings'}; net total ${p.amount}.`,
  balanceCollected: p =>
    `We collected the balance payment of ${p.amount} for booking ${p.bookingRef ?? ''}. The payout follows your configured schedule (1–3 business days depending on your Stripe settings).`,
  reminder: p =>
    `A payout of ${p.amount} is scheduled to release on ${p.whenLabel ?? 'the upcoming release date'}. No action needed.`,
  released: p =>
    `${p.amount} has been released to your Stripe account. Funds typically arrive in your bank within 1–3 business days depending on your Stripe settings.`,
  failed: p =>
    `A payout of ${p.amount} could not be released${p.reason ? ` (${p.reason})` : ''}. Please check your Stripe dashboard; in most cases it's a bank-detail issue Stripe can guide you through.`,
  delayed: p =>
    `Your scheduled payout of ${p.amount} is on hold${p.reason ? ` (${p.reason})` : ''}. We'll let you know as soon as Stripe releases it.`,
}

export default function ProviderPayoutEvent(props: ProviderPayoutEventProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {props.companyName}
        </Text>
        {props.bookingRef ? (
          <Text style={detailLine}>
            <strong>Booking reference:</strong> {props.bookingRef}
          </Text>
        ) : null}
        <Text style={detailLine}>
          <strong>Amount:</strong> {props.amount}
        </Text>
        {props.whenLabel ? (
          <Text style={detailLine}>
            <strong>Release:</strong> {props.whenLabel}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={props.payoutsUrl}>View payouts</BrandedButton>
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

export const PreviewProps: ProviderPayoutEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  bookingRef: 'WC-2026-A8K3LM',
  amount: '$2,340.00',
  whenLabel: '12 July 2026',
  kind: 'released',
  reason: null,
  payoutsUrl: 'https://provider.worldcamps.com/payouts',
}
