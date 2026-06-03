import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentPostDeclineAlternativesProps {
  salutation: SalutationStyle
  firstName?: string | null
  /** Camp the parent was previously interested in. */
  originalCampName: string
  /** Pre-built link to a search results page with similar camps. */
  alternativesUrl: string
}

export default function ParentPostDeclineAlternatives({
  salutation,
  firstName,
  originalCampName,
  alternativesUrl,
}: ParentPostDeclineAlternativesProps) {
  return (
    <Layout preview={`Programs similar to ${originalCampName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>We found programs you might love.</Heading>
      <Text style={paragraphStyle}>
        Sorry your booking for {originalCampName} didn&apos;t work out — we&apos;ve put together a
        shortlist of similar camps with availability that could be a great fit for your family.
      </Text>
      <BrandedButton href={alternativesUrl}>See alternatives</BrandedButton>
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

export const PreviewProps: ParentPostDeclineAlternativesProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  originalCampName: 'Alpine Adventure Camp',
  alternativesUrl: 'https://app.worldcamps.com/camps?similar-to=alpine-adventure',
}
