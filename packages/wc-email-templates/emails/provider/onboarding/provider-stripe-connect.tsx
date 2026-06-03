import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type StripeConnectStage = 'nudge' | 'reminder' | 'disconnected'

export interface ProviderStripeConnectProps {
  companyName: string
  stage: StripeConnectStage
  /** Optional reason from the deauthorize webhook (only used for disconnected). */
  reason?: string | null
  connectUrl: string
}

const HEADINGS: Record<StripeConnectStage, string> = {
  nudge: 'Connect Stripe to start accepting bookings.',
  reminder: 'Reminder: connect Stripe to publish your camps.',
  disconnected: 'Your Stripe account has been disconnected.',
}

const BODIES: Record<
  StripeConnectStage,
  (co: string, reason: string | null | undefined) => string
> = {
  nudge: co =>
    `${co} is approved but not yet ready to accept bookings — you still need to connect Stripe so families can pay. The flow takes about 5 minutes.`,
  reminder: co =>
    `Just a nudge — ${co} can't accept paid bookings until Stripe is connected. Most providers complete this in 5 minutes.`,
  disconnected: (co, reason) =>
    `Your Stripe account for ${co} has been disconnected${reason ? ` (${reason})` : ''}. New bookings will be blocked until you reconnect.`,
}

export default function ProviderStripeConnect({
  companyName,
  stage,
  reason,
  connectUrl,
}: ProviderStripeConnectProps) {
  return (
    <Layout preview={HEADINGS[stage]}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](companyName, reason)}</Text>
      <BrandedButton href={connectUrl}>
        {stage === 'disconnected' ? 'Reconnect Stripe' : 'Connect Stripe now'}
      </BrandedButton>
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

export const PreviewProps: ProviderStripeConnectProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  stage: 'nudge',
  reason: null,
  connectUrl: 'https://provider.worldcamps.com/onboarding/stripe-connect',
}
