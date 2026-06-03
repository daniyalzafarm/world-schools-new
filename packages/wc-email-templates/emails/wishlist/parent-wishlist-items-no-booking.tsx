import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentWishlistItemsNoBookingProps {
  salutation: SalutationStyle
  firstName?: string | null
  /** Number of items currently saved. */
  itemCount: number
  /** First saved camp name (used as the lead-in). */
  leadCampName: string
  /** Days since the wishlist was started — 7 or 21. */
  daysSinceSaved: number
  wishlistUrl: string
}

export default function ParentWishlistItemsNoBooking({
  salutation,
  firstName,
  itemCount,
  leadCampName,
  daysSinceSaved,
  wishlistUrl,
}: ParentWishlistItemsNoBookingProps) {
  return (
    <Layout preview={`Still thinking about ${leadCampName}?`}>
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Still thinking about {leadCampName}?</Heading>
      <Text style={paragraphStyle}>
        It&apos;s been {daysSinceSaved} days since you saved {leadCampName}
        {itemCount > 1 ? ` and ${itemCount - 1} more` : ''}. Places do fill up — have a fresh look
        and lock in the dates that work for you.
      </Text>
      <BrandedButton href={wishlistUrl}>Open your wishlist</BrandedButton>
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

export const PreviewProps: ParentWishlistItemsNoBookingProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  itemCount: 3,
  leadCampName: 'Alpine Adventure Camp',
  daysSinceSaved: 7,
  wishlistUrl: 'https://app.worldcamps.com/wishlist',
}
