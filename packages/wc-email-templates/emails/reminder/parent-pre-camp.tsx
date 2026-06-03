import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type PreCampStage = 'checklist14d' | 'packing7d' | 'dayBefore'

export interface ParentPreCampProps {
  salutation: SalutationStyle
  firstName?: string | null
  childName: string
  campName: string
  bookingRef: string
  startDate: string
  bookingUrl: string
  stage: PreCampStage
}

const HEADINGS: Record<PreCampStage, string> = {
  checklist14d: 'Two weeks to go — let&apos;s get ready.',
  packing7d: 'Packing time — one week to go.',
  dayBefore: "Tomorrow's the day!",
}

const BODIES: Record<PreCampStage, (child: string, camp: string) => string> = {
  checklist14d: (child, camp) =>
    `Camp at ${camp} starts in 14 days for ${child}. Now&apos;s the time to check your booking page for any forms, kit lists or pre-arrival notes from the camp team.`,
  packing7d: (child, camp) =>
    `It&apos;s only one week until ${child} sets off for ${camp}. Have a look at the packing list on your booking page and let the camp know about anything we should be aware of.`,
  dayBefore: (child, camp) =>
    `${camp} starts tomorrow for ${child}. We&apos;re wishing you a fantastic experience — final logistics are on your booking page if you need them.`,
}

export default function ParentPreCamp({
  salutation,
  firstName,
  childName,
  campName,
  bookingRef,
  startDate,
  bookingUrl,
  stage,
}: ParentPreCampProps) {
  return (
    <Layout preview={`${childName} — ${campName} (${startDate})`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[stage]}</Heading>
      <Text style={paragraphStyle}>{BODIES[stage](childName, campName)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Booking reference:</strong> {bookingRef}
        </Text>
        <Text style={detailLine}>
          <strong>Start date:</strong> {startDate}
        </Text>
      </InfoPanel>
      <BrandedButton href={bookingUrl}>View your booking</BrandedButton>
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

export const PreviewProps: ParentPreCampProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  childName: 'Emma',
  campName: 'Alpine Adventure Camp',
  bookingRef: 'WC-2026-A8K3LM',
  startDate: '12 July 2026',
  bookingUrl: 'https://app.worldcamps.com/bookings/WC-2026-A8K3LM',
  stage: 'checklist14d',
}
