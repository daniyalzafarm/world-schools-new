import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type ProviderPreCampStage = 'rosterReady' | 'checklist' | 'dayBefore' | 'postCampWrap'

export interface ProviderPreCampProps {
  companyName: string
  campName: string
  /** Pre-formatted start date or end date depending on stage. */
  whenLabel: string
  /** Confirmed participant count for this session. */
  participantCount: number
  stage: ProviderPreCampStage
  dashboardUrl: string
}

const HEADINGS: Record<ProviderPreCampStage, string> = {
  rosterReady: 'Your roster is ready to download.',
  checklist: 'Two weeks out — pre-camp checklist.',
  dayBefore: 'Camp starts tomorrow.',
  postCampWrap: 'Camp wrap-up reminders.',
}

const BODIES: Record<ProviderPreCampStage, (camp: string, when: string, count: number) => string> =
  {
    rosterReady: (camp, when, count) =>
      `Your roster for ${camp} starting ${when} (${count} confirmed participants) is ready in the dashboard. Download it for staff briefings.`,
    checklist: (camp, when, count) =>
      `${camp} starts in two weeks (${when}) with ${count} families confirmed. Now's a good time to send any pre-arrival logistics + remind staff of allergies / accommodations.`,
    dayBefore: (camp, when, count) =>
      `${camp} starts tomorrow (${when}). ${count} families are arriving. Final reminders, drop-off logistics, and emergency contacts are in the dashboard.`,
    postCampWrap: (camp, _when, count) =>
      `Wrap-up time for ${camp}: ${count} families just finished. Sending a thank-you message + asking for reviews boosts your conversion on future sessions.`,
  }

export default function ProviderPreCamp({
  companyName,
  campName,
  whenLabel,
  participantCount,
  stage,
  dashboardUrl,
}: ProviderPreCampProps) {
  return (
    <Layout preview={HEADINGS[stage]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](campName, whenLabel, participantCount)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {companyName}
        </Text>
        <Text style={detailLine}>
          <strong>Camp:</strong> {campName}
        </Text>
        <Text style={detailLine}>
          <strong>{stage === 'postCampWrap' ? 'Ended' : 'Starts'}:</strong> {whenLabel}
        </Text>
        <Text style={detailLine}>
          <strong>Participants:</strong> {participantCount}
        </Text>
      </InfoPanel>
      <BrandedButton href={dashboardUrl}>Open dashboard</BrandedButton>
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

export const PreviewProps: ProviderPreCampProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  campName: 'Alpine Adventure Camp',
  whenLabel: '12 July 2026',
  participantCount: 24,
  stage: 'checklist',
  dashboardUrl: 'https://provider.worldcamps.com/dashboard',
}
