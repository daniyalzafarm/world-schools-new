import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { InfoPanel } from '../_shared/info-panel'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export type WishlistEventKind =
  | 'priceDrop'
  | 'fillingUp'
  | 'deadlineApproaching'
  | 'earlyBirdIncrease'

export interface ParentWishlistEventProps {
  salutation: SalutationStyle
  firstName?: string | null
  campName: string
  /** Optional session name when the event targets a specific session. */
  sessionName?: string | null
  /** Event-specific descriptor — old/new price for price drops, places left
   *  for filling-up, deadline for deadline approaching. */
  detail: string
  campUrl: string
  kind: WishlistEventKind
}

const HEADINGS: Record<WishlistEventKind, (camp: string) => string> = {
  priceDrop: camp => `Price drop on ${camp}.`,
  fillingUp: camp => `${camp} is filling up fast.`,
  deadlineApproaching: camp => `Booking deadline approaching for ${camp}.`,
  earlyBirdIncrease: camp => `Early-bird pricing ending on ${camp}.`,
}

const BODIES: Record<WishlistEventKind, (detail: string) => string> = {
  priceDrop: detail =>
    `Good news — a camp on your wishlist is now available at a lower price. ${detail}`,
  fillingUp: detail => `Only a few places remain. ${detail}`,
  deadlineApproaching: detail => `The booking deadline is coming up. ${detail}`,
  earlyBirdIncrease: detail => `Early-bird pricing closes soon. ${detail}`,
}

export default function ParentWishlistEvent({
  salutation,
  firstName,
  campName,
  sessionName,
  detail,
  campUrl,
  kind,
}: ParentWishlistEventProps) {
  return (
    <Layout preview={HEADINGS[kind](campName)}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>{HEADINGS[kind](campName)}</Heading>
      <Text style={paragraphStyle}>{BODIES[kind](detail)}</Text>
      <InfoPanel>
        <Text style={detailLine}>
          <strong>Camp:</strong> {campName}
        </Text>
        {sessionName ? (
          <Text style={detailLine}>
            <strong>Session:</strong> {sessionName}
          </Text>
        ) : null}
      </InfoPanel>
      <BrandedButton href={campUrl}>View camp</BrandedButton>
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

export const PreviewProps: ParentWishlistEventProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  campName: 'Alpine Adventure Camp',
  sessionName: 'Two-Week Mountain Discovery — Session 3',
  detail: 'Was $2,600 — now $2,200 through 15 June.',
  campUrl: 'https://app.worldcamps.com/camps/alpine-adventure',
  kind: 'priceDrop',
}
