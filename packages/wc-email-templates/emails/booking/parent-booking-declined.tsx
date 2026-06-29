import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingDeclinedProps {
  salutation: SalutationStyle
  firstName?: string | null
  /**
   * Child the declined request was for. Carried for the in-app notification
   * (disambiguates multi-child households) but deliberately NOT rendered in
   * this email: the child's name is kept out of the decline email for GDPR
   * data-minimisation (email is a forwardable channel).
   */
  childName: string
  campName: string
  programName: string
  /** Pre-rendered session window, e.g. "10–17 Aug 2026". */
  sessionRange: string
  /** Booking reference (BookingGroup.bookingGroupNumber). */
  bookingRef: string
  /** Decline reason label (already humanised). Optional. */
  declineReason?: string
  /** "Browse similar camps" deep link on wc-booking. */
  browseUrl: string
}

/**
 * Parent — Booking request not confirmed.
 *
 * Spec: WorldCamps notifications catalog → "For Parents" #4 (Booking Request
 * Declined). Tone: neutral framing of the reason — declines are a logistical
 * reality, not a rejection of the family.
 */
export default function ParentBookingDeclined({
  salutation,
  firstName,
  campName,
  programName,
  sessionRange,
  bookingRef,
  declineReason,
  browseUrl,
}: ParentBookingDeclinedProps) {
  return (
    <Layout preview={`Your booking request for ${campName} wasn't confirmed`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>
        Unfortunately, {campName} was unable to confirm your booking request for {programName}.
      </Heading>

      {declineReason ? (
        <InfoPanel>
          <Text style={detailLine}>
            <strong>Reason:</strong> {declineReason}
          </Text>
        </InfoPanel>
      ) : null}

      <Text style={paragraphStyle}>
        You have not been charged. We know this is disappointing — but don&apos;t give up. There are
        many similar programs that might be a great fit.
      </Text>

      <Text style={paragraphStyle}>
        Booking reference: <strong>{bookingRef}</strong>
        {sessionRange ? (
          <>
            {' '}
            · Session: <strong>{sessionRange}</strong>
          </>
        ) : null}
      </Text>

      <BrandedButton href={browseUrl}>Browse similar camps</BrandedButton>

      <Text style={paragraphStyle}>
        If you&apos;d like a personal recommendation or have any questions, just reply to this email
        — we&apos;d love to help.
      </Text>

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

export const PreviewProps: ParentBookingDeclinedProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  programName: 'Two-Week Mountain Discovery — Session 3',
  sessionRange: '12–26 Jul 2026',
  bookingRef: 'WC-2026-A8K3LM',
  declineReason: 'Capacity or scheduling conflict',
  browseUrl: 'https://app.worldcamps.com/camps?similar-to=alpine-adventure',
}
