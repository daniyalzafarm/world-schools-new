import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type SuperadminCampOnboardingKind =
  | 'applicationNew'
  | 'docsUploaded'
  | 'docsNotUploaded'
  | 'profileIncomplete14d'
  | 'firstListingLive'

export interface SuperadminCampOnboardingProps {
  /** Camp / provider legal name. */
  companyName: string
  /** ISO 3166-1 alpha-2 or full country name. Optional — fallback hides the row. */
  country?: string | null
  /** For docsNotUploaded / profileIncomplete14d — days since application approval. */
  daysSinceApproval?: number | null
  kind: SuperadminCampOnboardingKind
  /** Deep-link to the camp in the superadmin dashboard. */
  reviewUrl: string
}

const HEADINGS: Record<SuperadminCampOnboardingKind, string> = {
  applicationNew: 'New camp application submitted.',
  docsUploaded: 'Verification documents ready for review.',
  docsNotUploaded: 'Camp has not uploaded verification documents.',
  profileIncomplete14d: 'Camp profile still incomplete after 14 days.',
  firstListingLive: 'New camp listing published.',
}

const BODIES: Record<
  SuperadminCampOnboardingKind,
  (props: SuperadminCampOnboardingProps) => string
> = {
  applicationNew: p =>
    `${p.companyName}${p.country ? ` from ${p.country}` : ''} has submitted an onboarding application. Open the review queue to triage.`,
  docsUploaded: p =>
    `${p.companyName} has uploaded their verification documents. Please review and approve so the provider can go live.`,
  docsNotUploaded: p =>
    `${p.companyName} was approved ${p.daysSinceApproval ?? 5} days ago but has not yet uploaded verification documents. Consider nudging the provider.`,
  profileIncomplete14d: p =>
    `${p.companyName} was approved ${p.daysSinceApproval ?? 14} days ago and their profile is still incomplete. They cannot publish listings until this is resolved.`,
  firstListingLive: p => `${p.companyName} has published their first listing on World Camps.`,
}

export default function SuperadminCampOnboarding(props: SuperadminCampOnboardingProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Camp:</strong> {props.companyName}
        </Text>
        {props.country ? (
          <Text style={detailLine}>
            <strong>Country:</strong> {props.country}
          </Text>
        ) : null}
        {props.daysSinceApproval != null ? (
          <Text style={detailLine}>
            <strong>Days since approval:</strong> {props.daysSinceApproval}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={props.reviewUrl}>Open in admin</BrandedButton>
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

export const PreviewProps: SuperadminCampOnboardingProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  country: 'Switzerland',
  daysSinceApproval: 14,
  kind: 'profileIncomplete14d',
  reviewUrl: 'https://admin.worldcamps.com/providers/wc-prov-abc',
}
