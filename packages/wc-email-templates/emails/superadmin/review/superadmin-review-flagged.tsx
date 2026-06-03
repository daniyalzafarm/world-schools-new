import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export interface SuperadminReviewFlaggedProps {
  parentName: string
  companyName: string
  /** Star rating 1-5 if applicable; null for non-rating reviews. */
  rating?: number | null
  /** First line / excerpt of the review for context. */
  excerpt?: string | null
  reviewUrl: string
}

export default function SuperadminReviewFlagged(props: SuperadminReviewFlaggedProps) {
  const heading = 'Review flagged — action may be required.'
  return (
    <Layout preview={heading}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{heading}</Heading>
      <Text style={paragraphStyle}>
        A verified review submitted by {props.parentName} for {props.companyName} has been
        auto-published and flagged for moderation review.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Camp:</strong> {props.companyName}
        </Text>
        <Text style={detailLine}>
          <strong>Reviewer:</strong> {props.parentName}
        </Text>
        {props.rating != null ? (
          <Text style={detailLine}>
            <strong>Rating:</strong> {props.rating}/5
          </Text>
        ) : null}
        {props.excerpt ? (
          <Text style={detailLine}>
            <strong>Excerpt:</strong> {props.excerpt}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={props.reviewUrl}>Review in admin</BrandedButton>
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

export const PreviewProps: SuperadminReviewFlaggedProps = {
  parentName: 'Sarah Johnson',
  companyName: 'Alpine Adventure Camp Ltd',
  rating: 2,
  excerpt: 'The accommodations were not as described and the staff were unhelpful…',
  reviewUrl: 'https://admin.worldcamps.com/reviews/wc-rev-abc',
}
