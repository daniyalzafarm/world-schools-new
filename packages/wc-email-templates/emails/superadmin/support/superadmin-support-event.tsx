import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type SuperadminSupportEventKind = 'ticketNew' | 'ticketReply'

export interface SuperadminSupportEventProps {
  /** Submitter display name (parent first name, provider company name, etc.). */
  submitterName: string
  /** parent | provider — drives the heading verbiage. */
  submitterType: 'parent' | 'provider' | 'guest'
  /** Ticket reference (e.g. ST-2026-001). */
  ticketRef: string
  /** Ticket subject / topic. */
  subject: string
  kind: SuperadminSupportEventKind
  reviewUrl: string
}

const HEADINGS: Record<SuperadminSupportEventKind, string> = {
  ticketNew: 'New support ticket received.',
  ticketReply: 'Reply received on a support ticket.',
}

const BODIES: Record<SuperadminSupportEventKind, (props: SuperadminSupportEventProps) => string> = {
  ticketNew: p =>
    `A new support ticket has been submitted by ${p.submitterName} (${p.submitterType}) regarding "${p.subject}". Review and triage.`,
  ticketReply: p =>
    `${p.submitterName} has replied to support ticket ${p.ticketRef} ("${p.subject}"). Open the conversation to respond.`,
}

export default function SuperadminSupportEvent(props: SuperadminSupportEventProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Ticket:</strong> {props.ticketRef}
        </Text>
        <Text style={detailLine}>
          <strong>Submitter:</strong> {props.submitterName} ({props.submitterType})
        </Text>
        <Text style={detailLine}>
          <strong>Subject:</strong> {props.subject}
        </Text>
      </InfoPanel>
      <BrandedButton href={props.reviewUrl}>Open ticket</BrandedButton>
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

export const PreviewProps: SuperadminSupportEventProps = {
  submitterName: 'Sarah Johnson',
  submitterType: 'parent',
  ticketRef: 'ST-2026-001',
  subject: 'Cannot complete payment',
  kind: 'ticketNew',
  reviewUrl: 'https://admin.worldcamps.com/support/ST-2026-001',
}
