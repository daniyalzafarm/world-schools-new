import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type PostCampStage = 'request' | 'reminder' | 'survey'

export interface ParentPostCampReviewProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  reviewUrl: string
  stage: PostCampStage
}

const HEADINGS: Record<PostCampStage, string> = {
  request: 'How was the experience?',
  reminder: 'A quick reminder — share your review',
  survey: 'A few questions to help us improve',
}

const BODIES: Record<PostCampStage, (child: string, camp: string) => string> = {
  request: (child, camp) =>
    `${child}&apos;s time at ${camp} has wrapped up. Your honest review helps other families choose and helps the camp keep improving — it only takes a couple of minutes.`,
  reminder: (child, camp) =>
    `Just a gentle nudge — your feedback on ${child}&apos;s experience at ${camp} would mean a lot to other families considering the camp.`,
  survey: (child, camp) =>
    `Thanks again for booking with us. A quick survey about ${child}&apos;s experience at ${camp} would help us improve how we match families with camps.`,
}

export default function ParentPostCampReview({
  salutation,
  firstName,
  childName,
  campName,
  reviewUrl,
  stage,
}: ParentPostCampReviewProps) {
  return (
    <Layout preview={`Share your ${campName} experience`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](childName, campName)}</Text>
      <BrandedButton href={reviewUrl}>
        {stage === 'survey' ? 'Take the survey' : 'Leave a review'}
      </BrandedButton>
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

export const PreviewProps: ParentPostCampReviewProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  reviewUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM/review',
  stage: 'request',
}
