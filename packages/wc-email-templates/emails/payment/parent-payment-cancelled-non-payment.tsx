import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentPaymentCancelledNonPaymentProps {
  /** Spec: payment-related cancellation uses formal 'Dear' salutation. */
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  browseUrl: string
}

export default function ParentPaymentCancelledNonPayment({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  browseUrl,
}: ParentPaymentCancelledNonPaymentProps) {
  return (
    <Layout preview={`Booking cancelled — ${campName}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Your booking has been cancelled.</Heading>
      <Text style={paragraphStyle}>
        Because we weren&apos;t able to collect the balance payment for {childName}&apos;s place at{' '}
        {campName}, the booking has been cancelled. Your deposit is non-refundable per the
        cancellation policy you accepted at checkout.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
      </InfoPanel>
      <Text style={paragraphStyle}>
        If circumstances have changed and you&apos;d like to rebook, you can browse availability any
        time. We&apos;d love to help find the right fit for {childName}.
      </Text>
      <BrandedButton href={browseUrl}>Browse programs</BrandedButton>
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

export const PreviewProps: ParentPaymentCancelledNonPaymentProps = {
  salutation: 'dear',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  browseUrl: 'https://app.worldcamps.com/camps',
}
