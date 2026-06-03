import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type DisputeEventKind = 'opened' | 'evidenceDue' | 'resolvedWon' | 'resolvedLost'

export interface ProviderDisputeEventProps {
  companyName: string
  bookingRef: string
  amount: string
  /** Pre-formatted evidence-due date (only set for `opened` / `evidenceDue`). */
  evidenceDueLabel?: string | null
  kind: DisputeEventKind
  disputesUrl: string
}

const HEADINGS: Record<DisputeEventKind, string> = {
  opened: 'A chargeback was opened on a booking.',
  evidenceDue: 'Chargeback evidence is due soon.',
  resolvedWon: 'Chargeback closed in your favour.',
  resolvedLost: 'Chargeback was lost.',
}

const BODIES: Record<DisputeEventKind, (props: ProviderDisputeEventProps) => string> = {
  opened: p =>
    `The family's bank has opened a chargeback for ${p.amount} on booking ${p.bookingRef}. Stripe debited the disputed amount immediately. Submitting strong evidence is the only way to recover it — the deadline is ${p.evidenceDueLabel ?? 'shown in the dashboard'}.`,
  evidenceDue: p =>
    `Reminder: evidence for the ${p.amount} chargeback on booking ${p.bookingRef} is due ${p.evidenceDueLabel ?? 'soon'}. Submitting after the deadline forfeits the dispute.`,
  resolvedWon: p =>
    `The chargeback for ${p.amount} on booking ${p.bookingRef} was closed in your favour. Stripe has reinstated the funds to your connected account.`,
  resolvedLost: p =>
    `The chargeback for ${p.amount} on booking ${p.bookingRef} was lost. The disputed amount and Stripe's chargeback fee have been debited from your connected account.`,
}

export default function ProviderDisputeEvent(props: ProviderDisputeEventProps) {
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
          <strong>Disputed amount:</strong> {props.amount}
        </Text>
        {props.evidenceDueLabel ? (
          <Text style={detailLine}>
            <strong>Evidence due:</strong> {props.evidenceDueLabel}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={props.disputesUrl}>Open dispute</BrandedButton>
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

export const PreviewProps: ProviderDisputeEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  bookingRef: 'WC-2026-A8K3LM',
  amount: '$2,600.00',
  evidenceDueLabel: '5 June 2026',
  kind: 'opened',
  disputesUrl: 'https://provider.worldcamps.com/disputes',
}
