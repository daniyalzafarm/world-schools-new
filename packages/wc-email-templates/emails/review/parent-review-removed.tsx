import { Heading, Text } from '@react-email/components'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentReviewRemovedProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  /** Reason copy from the moderation decision. */
  reasonLabel: string
}

export default function ParentReviewRemoved({
  salutation,
  firstName,
  campName,
  reasonLabel,
}: ParentReviewRemovedProps) {
  return (
    <Layout preview={`Your review of ${campName} was removed`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>We&apos;ve removed your review.</Heading>
      <Text style={paragraphStyle}>
        Your review of {campName} has been removed by our moderation team.
        <br />
        <strong>Reason:</strong> {reasonLabel}
      </Text>
      <Text style={paragraphStyle}>
        If you believe this is a mistake, simply reply to this email and we&apos;ll have another
        look.
      </Text>
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
const paragraphStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
}
const signOffStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0 0',
}

export const PreviewProps: ParentReviewRemovedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  reasonLabel: 'Content violated our review guidelines on personal attacks.',
}
