import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentReviewResponsePublishedProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  /** Truncated preview of the camp's response. */
  preview: string
  reviewUrl: string
}

export default function ParentReviewResponsePublished({
  salutation,
  firstName,
  campName,
  preview,
  reviewUrl,
}: ParentReviewResponsePublishedProps) {
  return (
    <Layout preview={`${campName} replied to your review`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{campName} replied to your review.</Heading>
      <InfoPanel>
        <Text style={detailLine}>
          <em>&ldquo;{preview}&rdquo;</em>
        </Text>
      </InfoPanel>
      <BrandedButton href={reviewUrl}>Read the full reply</BrandedButton>
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

export const PreviewProps: ParentReviewResponsePublishedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  preview: 'Thank you for the lovely review, Sarah — Emma was a joy to have...',
  reviewUrl: 'https://app.worldcamps.com/reviews/REV-A8K3',
}
