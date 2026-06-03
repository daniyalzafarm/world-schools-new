import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type ReviewEventKind =
  | 'newReview'
  | 'responsePublished'
  | 'notRespondedReminder'
  | 'reviewRemoved'

export interface ProviderReviewEventProps {
  companyName: string
  campName: string
  /** Optional rating (1-5) — only set for newReview / notRespondedReminder. */
  rating?: number | null
  preview?: string
  kind: ReviewEventKind
  /** Reason copy from moderation (only meaningful for `reviewRemoved`). */
  reasonLabel?: string | null
  reviewsUrl: string
}

const HEADINGS: Record<ReviewEventKind, (camp: string) => string> = {
  newReview: camp => `New review for ${camp}.`,
  responsePublished: camp => `Your reply on a ${camp} review is live.`,
  notRespondedReminder: camp => `Reminder: respond to a review on ${camp}.`,
  reviewRemoved: camp => `A review on ${camp} was removed.`,
}

const BODIES: Record<ReviewEventKind, (props: ProviderReviewEventProps) => string> = {
  newReview: p =>
    `A family left a${p.rating ? ` ${p.rating}-star` : ''} review for ${p.campName}. Responding within a week helps families trust your replies; we'll surface the response under their review.`,
  responsePublished: p =>
    `Your response on a ${p.campName} review is now visible to other families.`,
  notRespondedReminder: p =>
    `A${p.rating ? ` ${p.rating}-star` : ''} review on ${p.campName} is still waiting for your reply. Replying within 7 days is the spec recommendation.`,
  reviewRemoved: p =>
    `A review on ${p.campName} was removed by our moderation team.${p.reasonLabel ? ` Reason: ${p.reasonLabel}.` : ''}`,
}

export default function ProviderReviewEvent(props: ProviderReviewEventProps) {
  return (
    <Layout preview={HEADINGS[props.kind](props.campName)}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind](props.campName)}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      {props.preview ? (
        <InfoPanel>
          <Text style={detailLine}>
            <em>&ldquo;{props.preview}&rdquo;</em>
          </Text>
        </InfoPanel>
      ) : null}
      <BrandedButton href={props.reviewsUrl}>Open reviews</BrandedButton>
      <Text style={signOffStyle}>The World Camps Team — {props.companyName}</Text>
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

export const PreviewProps: ProviderReviewEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  campName: 'Alpine Adventure Camp',
  rating: 5,
  preview: 'Emma had an incredible week — the staff were amazing…',
  kind: 'newReview',
  reasonLabel: null,
  reviewsUrl: 'https://provider.worldcamps.com/reviews',
}
