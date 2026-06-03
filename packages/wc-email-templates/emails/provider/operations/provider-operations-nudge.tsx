import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type OperationsNudgeKind = 'seasonEnded' | 'programsNotUpdated30d' | 'programsNotUpdated60d'

export interface ProviderOperationsNudgeProps {
  companyName: string
  /** Optional camp count or last-update date for context. */
  detail?: string | null
  kind: OperationsNudgeKind
  campsUrl: string
}

const HEADINGS: Record<OperationsNudgeKind, string> = {
  seasonEnded: 'Your season has wrapped up.',
  programsNotUpdated30d: 'Programs not updated in 30 days.',
  programsNotUpdated60d: 'Programs not updated in 60 days.',
}

const BODIES: Record<
  OperationsNudgeKind,
  (co: string, detail: string | null | undefined) => string
> = {
  seasonEnded: co =>
    `All ${co} sessions for this season have ended. Time to plan next season — duplicate sessions, refresh photos, update pricing.`,
  programsNotUpdated30d: (co, detail) =>
    `${co}'s programs haven't been updated in 30 days${detail ? ` (last update: ${detail})` : ''}. Out-of-date content reduces visibility in search.`,
  programsNotUpdated60d: (co, detail) =>
    `${co}'s programs haven't been updated in 60 days${detail ? ` (last update: ${detail})` : ''}. Sessions older than 60 days are deprioritised in search and may not surface for families browsing.`,
}

export default function ProviderOperationsNudge({
  companyName,
  detail,
  kind,
  campsUrl,
}: ProviderOperationsNudgeProps) {
  return (
    <Layout preview={HEADINGS[kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[kind](companyName, detail)}</Text>
      <BrandedButton href={campsUrl}>Open camp manager</BrandedButton>
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

export const PreviewProps: ProviderOperationsNudgeProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  detail: '15 March 2026',
  kind: 'programsNotUpdated30d',
  campsUrl: 'https://provider.worldcamps.com/camps',
}
