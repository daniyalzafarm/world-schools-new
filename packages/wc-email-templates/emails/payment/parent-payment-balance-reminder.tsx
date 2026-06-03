import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentPaymentBalanceReminderProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  balanceAmount: string
  balanceDueDate: string
  /** Days remaining until the balance is charged (14 / 7 / 3). */
  daysUntilDue: number
  bookingUrl: string
}

/**
 * Parent — Balance payment reminder.
 *
 * Single component covers the 14d / 7d / 3d cadence — the catalog entries
 * differentiate by subject + `daysUntilDue` prop. Spec: "For Parents" #10
 * (Balance Payment Reminder).
 */
export default function ParentPaymentBalanceReminder({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  balanceAmount,
  balanceDueDate,
  daysUntilDue,
  bookingUrl,
}: ParentPaymentBalanceReminderProps) {
  const dayWord = daysUntilDue === 1 ? 'day' : 'days'
  return (
    <Layout preview={`Balance for ${campName} due in ${daysUntilDue} ${dayWord}`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>
        Your balance is due in {daysUntilDue} {dayWord}.
      </Heading>
      <Text style={paragraphStyle}>
        A quick heads-up — the balance for {childName}&apos;s place at {campName} will be charged
        automatically on {balanceDueDate} using the card we have on file.
      </Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Balance due:</strong> {balanceAmount} on {balanceDueDate}
        </Text>
      </InfoPanel>
      <Text style={paragraphStyle}>
        If you&apos;d like to update the card on file or review your booking, you can do so from
        your dashboard.
      </Text>
      <BrandedButton href={bookingUrl}>Review your booking</BrandedButton>
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

export const PreviewProps: ParentPaymentBalanceReminderProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  balanceAmount: '$1,950.00',
  balanceDueDate: '12 May 2026',
  daysUntilDue: 7,
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
}
