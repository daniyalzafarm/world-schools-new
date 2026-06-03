import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type ProviderSupportEventKind = 'ticketReply' | 'ticketStatusChanged'

export interface ProviderSupportEventProps {
  companyName: string
  ticketSubject: string
  ticketRef: string
  /** Reply preview for `ticketReply`; status label for `ticketStatusChanged`. */
  detail: string
  kind: ProviderSupportEventKind
  ticketUrl: string
}

const HEADINGS: Record<ProviderSupportEventKind, string> = {
  ticketReply: 'New reply on your support ticket.',
  ticketStatusChanged: 'Your support ticket status changed.',
}

const BODIES: Record<ProviderSupportEventKind, (subject: string, detail: string) => string> = {
  ticketReply: subject => `Our support team replied to "${subject}".`,
  ticketStatusChanged: (subject, detail) =>
    `Your ticket "${subject}" is now ${detail.toLowerCase()}.`,
}

export default function ProviderSupportEvent({
  companyName,
  ticketSubject,
  ticketRef,
  detail,
  kind,
  ticketUrl,
}: ProviderSupportEventProps) {
  return (
    <Layout preview={HEADINGS[kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[kind](ticketSubject, detail)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {companyName}
        </Text>
        <Text style={detailLine}>
          <strong>Ticket:</strong> {ticketSubject}
        </Text>
        <Text style={detailLine}>
          <strong>Reference:</strong> {ticketRef}
        </Text>
        {kind === 'ticketReply' ? (
          <Text style={detailLine}>
            <em>&ldquo;{detail}&rdquo;</em>
          </Text>
        ) : (
          <Text style={detailLine}>
            <strong>New status:</strong> {detail}
          </Text>
        )}
      </InfoPanel>
      <BrandedButton href={ticketUrl}>Open ticket</BrandedButton>
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

export const PreviewProps: ProviderSupportEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  ticketSubject: 'Payout schedule clarification',
  ticketRef: 'WC-TKT-2026-P1Q2',
  detail: 'Thanks for reaching out — the payout schedule is configured per...',
  kind: 'ticketReply',
  ticketUrl: 'https://provider.worldcamps.com/support/WC-TKT-2026-P1Q2',
}
