import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type ProfileMilestoneStage = 'profileIncomplete' | 'profilePublished' | 'firstBooking'

export interface ProviderProfileMilestoneProps {
  companyName: string
  stage: ProfileMilestoneStage
  /** Completion score 0-100 (only meaningful for `profileIncomplete`). */
  completionScore?: number
  /** Optional context-specific link (camp page for firstBooking, etc.). */
  ctaUrl: string
}

const HEADINGS: Record<ProfileMilestoneStage, string> = {
  profileIncomplete: 'Your profile is incomplete.',
  profilePublished: 'Your profile is live.',
  firstBooking: 'You have your first booking!',
}

const BODIES: Record<ProfileMilestoneStage, (co: string, score: number | undefined) => string> = {
  profileIncomplete: (co, score) =>
    `${co}'s profile is ${score ?? 0}% complete. Filling in the remaining sections (logo, description, payment policies) helps families find and trust your camp.`,
  profilePublished: co =>
    `${co} is now visible in search. Families can discover, wishlist, and request a booking.`,
  firstBooking: co =>
    `Congratulations ${co} — your first booking request just arrived. Open the dashboard to review and respond.`,
}

const CTAS: Record<ProfileMilestoneStage, string> = {
  profileIncomplete: 'Complete your profile',
  profilePublished: 'View your camp',
  firstBooking: 'Review the request',
}

export default function ProviderProfileMilestone({
  companyName,
  stage,
  completionScore,
  ctaUrl,
}: ProviderProfileMilestoneProps) {
  return (
    <Layout preview={HEADINGS[stage]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](companyName, completionScore)}</Text>
      <BrandedButton href={ctaUrl}>{CTAS[stage]}</BrandedButton>
      <Text style={signOffStyle}>The World Camps Team</Text>
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

export const PreviewProps: ProviderProfileMilestoneProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  stage: 'profileIncomplete',
  completionScore: 60,
  ctaUrl: 'https://provider.worldcamps.com/dashboard',
}
