import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentBookingRequestWithdrawnProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  programName: string
  /** Browse-camps deep link to retain the parent. */
  browseUrl: string
}

/**
 * Parent — Booking request withdrawn.
 *
 * Spec: WorldCamps_Notifications_v28.xlsx → "For Parents" #8 (Booking Request
 * Withdrawn). Fires when the parent withdraws their own pending request.
 * Confirms no charge + offers a re-browse path.
 */
export default function ParentBookingRequestWithdrawn({
  salutation,
  firstName,
  campName,
  programName,
  browseUrl,
}: ParentBookingRequestWithdrawnProps) {
  return (
    <Layout preview={`Your booking request for ${campName} has been withdrawn`}>
      <Salutation style={salutation} firstName={firstName} />

      <Heading style={headingStyle}>Your booking request has been withdrawn.</Heading>

      <Text style={paragraphStyle}>
        Your booking request for {programName} at {campName} has been withdrawn.
        <strong> You have not been charged.</strong> If you change your mind, you can submit a new
        request at any time.
      </Text>

      <BrandedButton href={browseUrl}>Browse programs</BrandedButton>

      <Text style={paragraphStyle}>
        If you change your mind or have any questions, we&apos;re just a reply away.
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
const signOffStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0 0',
}

export const PreviewProps: ParentBookingRequestWithdrawnProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  programName: 'Two-Week Mountain Discovery — Session 3',
  browseUrl: 'https://app.worldcamps.com/camps',
}
