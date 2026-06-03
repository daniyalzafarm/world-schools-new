import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type MessagingEventKind = 'newFromFamily' | 'unanswered24h' | 'unanswered48h'

export interface ProviderMessagingEventProps {
  companyName: string
  parentDisplay: string
  /** Truncated message preview. */
  preview?: string
  kind: MessagingEventKind
  conversationUrl: string
}

const HEADINGS: Record<MessagingEventKind, (parent: string) => string> = {
  newFromFamily: parent => `New message from ${parent}.`,
  unanswered24h: parent => `Reminder: ${parent}'s message is still unanswered (24h).`,
  unanswered48h: parent => `Final reminder: ${parent}'s message has been waiting 48h.`,
}

const BODIES: Record<MessagingEventKind, (parent: string) => string> = {
  newFromFamily: parent =>
    `${parent} sent you a new message about a booking. Quick replies build trust and convert requests faster.`,
  unanswered24h: parent =>
    `${parent}'s message has been waiting 24 hours. Our SLA target for first reply is 24 hours — a quick response keeps families engaged.`,
  unanswered48h: parent =>
    `${parent}'s message is now 48 hours old. Long response times hurt your conversion + appear in your provider quality metrics.`,
}

export default function ProviderMessagingEvent({
  companyName,
  parentDisplay,
  preview,
  kind,
  conversationUrl,
}: ProviderMessagingEventProps) {
  return (
    <Layout preview={HEADINGS[kind](parentDisplay)}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[kind](parentDisplay)}</Heading>
      <Text style={paragraphStyle}>{BODIES[kind](parentDisplay)}</Text>
      {preview ? (
        <InfoPanel>
          <Text style={detailLine}>
            <em>&ldquo;{preview}&rdquo;</em>
          </Text>
        </InfoPanel>
      ) : null}
      <BrandedButton href={conversationUrl}>Reply now</BrandedButton>
      <Text style={signOffStyle}>The World Camps Team — {companyName}</Text>
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

export const PreviewProps: ProviderMessagingEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  parentDisplay: 'Sarah Bennett',
  preview: 'Hi — quick question about drop-off times…',
  kind: 'newFromFamily',
  conversationUrl: 'https://provider.worldcamps.com/messages/CONV-X9',
}
