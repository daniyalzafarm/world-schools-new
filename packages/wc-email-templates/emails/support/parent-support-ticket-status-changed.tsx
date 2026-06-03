import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentSupportTicketStatusChangedProps {
  salutation: SalutationStyle
  firstName?: string | null
  ticketSubject: string
  ticketRef: string
  /** Pre-formatted human-readable status (e.g. "Resolved"). */
  newStatusLabel: string
  ticketUrl: string
}

export default function ParentSupportTicketStatusChanged({
  salutation,
  firstName,
  ticketSubject,
  ticketRef,
  newStatusLabel,
  ticketUrl,
}: ParentSupportTicketStatusChangedProps) {
  return (
    <Layout preview={`Support update: ${ticketSubject} — ${newStatusLabel}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>
        Your support request is now {newStatusLabel.toLowerCase()}.
      </Heading>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Ticket:</strong> {ticketSubject}
        </Text>
        <Text style={detailLine}>
          <strong>Reference:</strong> {ticketRef}
        </Text>
        <Text style={detailLine}>
          <strong>New status:</strong> {newStatusLabel}
        </Text>
      </InfoPanel>
      <BrandedButton href={ticketUrl}>View ticket</BrandedButton>
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

export const PreviewProps: ParentSupportTicketStatusChangedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  ticketSubject: 'Question about session start time',
  ticketRef: 'WC-TKT-2026-A1B2',
  newStatusLabel: 'Resolved',
  ticketUrl: 'https://app.worldcamps.com/support/WC-TKT-2026-A1B2',
}
