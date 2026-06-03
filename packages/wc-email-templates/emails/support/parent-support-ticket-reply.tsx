import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentSupportTicketReplyProps {
  salutation: SalutationStyle
  firstName?: string | null
  ticketSubject: string
  ticketRef: string
  /** Truncated preview of the agent reply. */
  preview: string
  ticketUrl: string
}

export default function ParentSupportTicketReply({
  salutation,
  firstName,
  ticketSubject,
  ticketRef,
  preview,
  ticketUrl,
}: ParentSupportTicketReplyProps) {
  return (
    <Layout preview={`Support reply: ${ticketSubject}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>We&apos;ve replied to your support request.</Heading>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Ticket:</strong> {ticketSubject}
        </Text>
        <Text style={detailLine}>
          <strong>Reference:</strong> {ticketRef}
        </Text>
        <Text style={detailLine}>
          <em>&ldquo;{preview}&rdquo;</em>
        </Text>
      </InfoPanel>
      <BrandedButton href={ticketUrl}>Read full reply</BrandedButton>
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

export const PreviewProps: ParentSupportTicketReplyProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  ticketSubject: 'Question about session start time',
  ticketRef: 'WC-TKT-2026-A1B2',
  preview: 'Thanks for reaching out — drop-off opens at 8:30am on Sunday...',
  ticketUrl: 'https://app.worldcamps.com/support/WC-TKT-2026-A1B2',
}
