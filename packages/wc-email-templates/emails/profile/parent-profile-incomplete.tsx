import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentProfileIncompleteProps {
  salutation: SalutationStyle
  firstName?: string | null
  /** Current completion score (0–100). */
  completionScore: number
  profileUrl: string
}

export default function ParentProfileIncomplete({
  salutation,
  firstName,
  completionScore,
  profileUrl,
}: ParentProfileIncompleteProps) {
  return (
    <Layout preview="Finish setting up your World Camps profile">
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>
        Finish your profile to get the most out of World Camps.
      </Heading>
      <Text style={paragraphStyle}>
        Your profile is <strong>{completionScore}%</strong> complete. Adding a few more details
        (children&apos;s ages, languages, photo) helps camps tailor their welcome and means we can
        recommend programs that genuinely fit your family.
      </Text>
      <BrandedButton href={profileUrl}>Complete your profile</BrandedButton>
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

export const PreviewProps: ParentProfileIncompleteProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  completionScore: 40,
  profileUrl: 'https://app.worldcamps.com/account/profile',
}
