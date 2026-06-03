import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type AbandonStage = '3h' | '2d' | '4d' | '6d'

export interface ParentCheckoutAbandonedProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  resumeUrl: string
  stage: AbandonStage
}

const PREVIEWS: Record<AbandonStage, (camp: string) => string> = {
  '3h': camp => `Pick up where you left off — ${camp}`,
  '2d': camp => `Still interested in ${camp}?`,
  '4d': camp => `Don't miss your spot at ${camp}`,
  '6d': camp => `Last chance to finish your booking at ${camp}`,
}

const HEADINGS: Record<AbandonStage, string> = {
  '3h': 'Looks like you got pulled away.',
  '2d': 'Still thinking it over?',
  '4d': "Don't miss out on a spot.",
  '6d': 'Last call before your draft expires.',
}

const BODIES: Record<AbandonStage, (camp: string) => string> = {
  '3h': camp =>
    `You were just a few clicks away from booking ${camp}. Your draft is saved — pick up exactly where you left off whenever you have a moment.`,
  '2d': camp =>
    `Your draft booking for ${camp} is still here. Most popular sessions fill up quickly, so we wanted to give you a friendly nudge.`,
  '4d': camp => `Just a heads up — places for ${camp} are filling. Your draft is still saved.`,
  '6d': camp =>
    `Your draft booking for ${camp} will soon be cleared. Continue now to lock in your dates.`,
}

export default function ParentCheckoutAbandoned({
  salutation,
  firstName,
  campName,
  resumeUrl,
  stage,
}: ParentCheckoutAbandonedProps) {
  return (
    <Layout preview={PREVIEWS[stage](campName)}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](campName)}</Text>
      <BrandedButton href={resumeUrl}>Resume your booking</BrandedButton>
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

export const PreviewProps: ParentCheckoutAbandonedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  resumeUrl: 'https://app.worldcamps.com/bookings/draft/D-A1B2C3',
  stage: '3h',
}
