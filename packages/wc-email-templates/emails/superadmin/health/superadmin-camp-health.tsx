import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type SuperadminCampHealthKind =
  | 'stripeDisconnected'
  | 'deletionRequested'
  | 'profileNeedsAttention60d'
  | 'profileDeactivated'
  | 'unresponsiveExpiredRequests'

export interface SuperadminCampHealthProps {
  companyName: string
  /** For unresponsiveExpiredRequests: count of expired requests in the window. */
  expiredRequestCount?: number | null
  /** For seasonal entries — days since last session ended. */
  daysSinceLastSession?: number | null
  /** Stripe disconnect reason (free-form Stripe failure detail). */
  reason?: string | null
  kind: SuperadminCampHealthKind
  reviewUrl: string
}

const HEADINGS: Record<SuperadminCampHealthKind, string> = {
  stripeDisconnected: 'Camp payment account disconnected.',
  deletionRequested: 'Camp has requested account deletion.',
  profileNeedsAttention60d: 'Camp profile needs attention — 60 days inactive.',
  profileDeactivated: 'Camp profile paused after 90 days inactive.',
  unresponsiveExpiredRequests: 'Camp not responding to booking requests.',
}

const BODIES: Record<SuperadminCampHealthKind, (props: SuperadminCampHealthProps) => string> = {
  stripeDisconnected: p =>
    `${p.companyName}'s payout account has been disconnected${p.reason ? ` (${p.reason})` : ''}. Bookings cannot be accepted until reconnected.`,
  deletionRequested: p =>
    `${p.companyName} has requested deletion of their World Camps account. Admin review required before processing.`,
  profileNeedsAttention60d: p =>
    `${p.companyName}'s last session ended ${p.daysSinceLastSession ?? 60} days ago and their profile has not been updated. They will be auto-deactivated at 90 days without action.`,
  profileDeactivated: p =>
    `${p.companyName}'s profile has been paused after ${p.daysSinceLastSession ?? 90} days without an active session. Reactivation requires the provider to update their listings.`,
  unresponsiveExpiredRequests: p =>
    `${p.companyName} has had ${p.expiredRequestCount ?? 3} booking requests expire without a response in the past 7 days. Consider reaching out.`,
}

export default function SuperadminCampHealth(props: SuperadminCampHealthProps) {
  return (
    <Layout preview={HEADINGS[props.kind]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[props.kind]}</Heading>
      <Text style={paragraphStyle}>{BODIES[props.kind](props)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Camp:</strong> {props.companyName}
        </Text>
        {props.expiredRequestCount != null ? (
          <Text style={detailLine}>
            <strong>Expired requests (last 7d):</strong> {props.expiredRequestCount}
          </Text>
        ) : null}
        {props.daysSinceLastSession != null ? (
          <Text style={detailLine}>
            <strong>Days since last session:</strong> {props.daysSinceLastSession}
          </Text>
        ) : null}
        {props.reason ? (
          <Text style={detailLine}>
            <strong>Reason:</strong> {props.reason}
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

export const PreviewProps: SuperadminCampHealthProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  expiredRequestCount: 4,
  daysSinceLastSession: 60,
  reason: null,
  kind: 'profileNeedsAttention60d',
  reviewUrl: 'https://admin.worldcamps.com/providers/wc-prov-abc',
}
