import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type ApplicationStatusStage =
  | 'received'
  | 'approved'
  | 'declined'
  | 'documentReuploadRequested'
  | 'additionalInfoRequired'

export interface ProviderApplicationStatusProps {
  /** Provider's legal company name (used in opening line). */
  companyName: string
  stage: ApplicationStatusStage
  /** Optional reason / instruction text (decline reason, missing-document
   *  name, "additional info" prompt). */
  detail?: string | null
  /** Deep link to /onboarding/status or /onboarding/verification. */
  dashboardUrl: string
}

const HEADINGS: Record<ApplicationStatusStage, string> = {
  received: 'We received your application.',
  approved: 'Your application has been approved.',
  declined: "We weren't able to approve your application.",
  documentReuploadRequested: 'Action needed: please reupload a document.',
  additionalInfoRequired: 'Action needed: we need more information.',
}

const BODIES: Record<
  ApplicationStatusStage,
  (co: string, detail: string | null | undefined) => string
> = {
  received: co =>
    `Thank you, ${co}. Your application is in our review queue. Most providers hear back within 3 business days.`,
  approved: co =>
    `Welcome aboard, ${co}. You can now finish onboarding (Stripe Connect, payment policies) and publish your first camp.`,
  declined: (co, detail) =>
    `Your application for ${co} was not approved at this time.${detail ? ` Reason: ${detail}` : ''} If you'd like to appeal or update your submission, simply reply to this email.`,
  documentReuploadRequested: (co, detail) =>
    `Please reupload the following document for ${co}${detail ? `: ${detail}` : '.'} You can do this from your verification step in the dashboard.`,
  additionalInfoRequired: (co, detail) =>
    `We need a few more details from ${co} to finish our review${detail ? `: ${detail}` : '.'} You can update your application from the dashboard.`,
}

const CTAS: Record<ApplicationStatusStage, string> = {
  received: 'Open your dashboard',
  approved: 'Continue onboarding',
  declined: 'Get in touch',
  documentReuploadRequested: 'Upload document',
  additionalInfoRequired: 'Update application',
}

export default function ProviderApplicationStatus({
  companyName,
  stage,
  detail,
  dashboardUrl,
}: ProviderApplicationStatusProps) {
  return (
    <Layout preview={HEADINGS[stage]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](companyName, detail)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {companyName}
        </Text>
      </InfoPanel>
      <BrandedButton href={dashboardUrl}>{CTAS[stage]}</BrandedButton>
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

export const PreviewProps: ProviderApplicationStatusProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  stage: 'approved',
  detail: null,
  dashboardUrl: 'https://provider.worldcamps.com/onboarding/status',
}
