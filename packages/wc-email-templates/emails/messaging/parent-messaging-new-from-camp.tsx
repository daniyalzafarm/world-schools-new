import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentMessagingNewFromCampProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  senderName: string
  /** First line / preview of the message (truncated by the loader). */
  preview: string
  conversationUrl: string
}

export default function ParentMessagingNewFromCamp({
  salutation,
  firstName,
  campName,
  senderName,
  preview,
  conversationUrl,
}: ParentMessagingNewFromCampProps) {
  return (
    <Layout preview={`New message from ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>You have a new message from {campName}.</Heading>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>From:</strong> {senderName}
        </Text>
        <Text style={detailLine}>
          <em>&ldquo;{preview}&rdquo;</em>
        </Text>
      </InfoPanel>
      <BrandedButton href={conversationUrl}>Reply now</BrandedButton>
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

export const PreviewProps: ParentMessagingNewFromCampProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  senderName: 'Camp Director Jana',
  preview: "Hi Sarah — just wanted to share the packing list for Emma's session...",
  conversationUrl: 'https://app.worldcamps.com/messages/CONV-X9',
}
