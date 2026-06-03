import { describe, expect, it } from 'vitest'
import ParentPaymentCancelledNonPayment, {
  PreviewProps,
} from '../../emails/payment/parent-payment-cancelled-non-payment'
import { renderEmail } from '../lib/renderer'

describe('ParentPaymentCancelledNonPayment', () => {
  it('uses formal salutation + includes booking ref, child + camp, and a browse link', async () => {
    const { html, text } = await renderEmail(ParentPaymentCancelledNonPayment, PreviewProps)
    expect(html).toContain('Dear')
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.browseUrl)
    expect(text).toContain(PreviewProps.bookingRef)
  })
})
