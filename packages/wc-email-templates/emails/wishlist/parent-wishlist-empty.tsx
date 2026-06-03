import { Heading, Text } from '@react-email/components'
import { BrandedButton } from '../_shared/branded-button'
import { Layout } from '../_shared/layout'
import { Salutation, type SalutationStyle } from '../_shared/salutation'
import { theme } from '../_shared/theme'

export interface ParentWishlistEmptyProps {
  salutation: SalutationStyle
  firstName?: string | null
  browseUrl: string
}

export default function ParentWishlistEmpty({
  salutation,
  firstName,
  browseUrl,
}: ParentWishlistEmptyProps) {
  return (
    <Layout preview="Discover camps your family will love">
      <Salutation style={salutation} firstName={firstName} />
      <Heading style={headingStyle}>Your wishlist is empty.</Heading>
      <Text style={paragraphStyle}>
        Browse camps, save your favourites with the heart icon, and we&apos;ll keep you posted on
        prices, availability, and special offers.
      </Text>
      <BrandedButton href={browseUrl}>Browse camps</BrandedButton>
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

export const PreviewProps: ParentWishlistEmptyProps = {
  salutation: 'hi',
  firstName: 'Sarah',
  browseUrl: 'https://app.worldcamps.com/camps',
}
