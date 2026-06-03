import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../../_shared/branded-button'
import { InfoPanel } from '../../_shared/info-panel'
import { Layout } from '../../_shared/layout'
import { Salutation } from '../../_shared/salutation'
import { theme } from '../../_shared/theme'

export type BookingEventKind =
  | 'cancelledByFamily'
  | 'cancelledNonPayment'
  | 'requestWithdrawn'
  | 'modified'
  | 'request48hReminder'
  | 'requestFinalReminder'
  | 'requestExpired'

export interface ProviderBookingEventProps {
  companyName: string
  bookingRef: string
  /** Pre-formatted "Two-Week Mountain Discovery — Session 3". */
  programName: string
  /** Optional pre-formatted child name; never used for cancellation copy. */
  parentName?: string | null
  /** Optional refund amount, dispute amount, change summary — depends on kind. */
  detail?: string | null
  kind: BookingEventKind
  bookingUrl: string
}

const HEADINGS: Record<BookingEventKind, (ref: string) => string> = {
  cancelledByFamily: ref => `Booking ${ref} was cancelled by the family.`,
  cancelledNonPayment: ref => `Booking ${ref} was cancelled — we couldn't collect the balance.`,
  requestWithdrawn: ref => `Request ${ref} was withdrawn.`,
  modified: ref => `Booking ${ref} was updated.`,
  request48hReminder: ref => `Reminder: respond to request ${ref} within 24 hours.`,
  requestFinalReminder: ref => `Final reminder: respond to request ${ref}.`,
  requestExpired: ref => `Request ${ref} expired without a response.`,
}

const BODIES: Record<
  BookingEventKind,
  (program: string, detail: string | null | undefined) => string
> = {
  cancelledByFamily: (program, detail) =>
    `The family cancelled their booking for ${program}.${detail ? ` ${detail}` : ''}`,
  cancelledNonPayment: program =>
    `The balance payment for ${program} could not be collected after the full retry window. The booking has been cancelled per policy; the deposit is retained per the parent's signed cancellation policy.`,
  requestWithdrawn: program =>
    `The family withdrew their pending request for ${program}. The capacity is back in your inventory.`,
  modified: (program, detail) =>
    `The booking for ${program} was updated.${detail ? ` Changes: ${detail}` : ''}`,
  request48hReminder: program =>
    `The booking request for ${program} is still pending. The 72-hour response window closes in 24 hours.`,
  requestFinalReminder: program =>
    `The booking request for ${program} closes in just a few hours. After that, the request auto-expires and the family will need to re-submit.`,
  requestExpired: program =>
    `The 72-hour response window for ${program} elapsed without a response. The request has been auto-expired and the family has been refunded any held funds.`,
}

export default function ProviderBookingEvent({
  companyName,
  bookingRef,
  programName,
  parentName,
  detail,
  kind,
  bookingUrl,
}: ProviderBookingEventProps) {
  return (
    <Layout preview={HEADINGS[kind](bookingRef)}>
      <Salutation style="none" />
      <Heading style={headingStyle}>{HEADINGS[kind](bookingRef)}</Heading>
      <Text style={paragraphStyle}>{BODIES[kind](programName, detail)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Provider:</strong> {companyName}
        </Text>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Program:</strong> {programName}
        </Text>
        {parentName ? (
          <Text style={detailLine}>
            <strong>Family:</strong> {parentName}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={bookingUrl}>Open booking</BrandedButton>
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

export const PreviewProps: ProviderBookingEventProps = {
  companyName: 'Alpine Adventure Camp Ltd',
  bookingRef: 'WC-2026-A8K3LM',
  programName: 'Two-Week Mountain Discovery — Session 3',
  parentName: 'Sarah Bennett',
  detail: 'Refund of $1,950 issued under the 30-day tier.',
  kind: 'cancelledByFamily',
  bookingUrl: 'https://provider.worldcamps.com/bookings/WC-2026-A8K3LM',
}
