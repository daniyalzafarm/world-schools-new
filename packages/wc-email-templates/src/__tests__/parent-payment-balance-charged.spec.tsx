import { describe, expect, it } from 'vitest'
import ParentPaymentBalanceCharged, {
  PreviewProps,
} from '../../emails/payment/parent-payment-balance-charged'
import { renderEmail } from '../lib/renderer'

describe('ParentPaymentBalanceCharged', () => {
  it('includes the booking ref, balance amount, child name, and start date', async () => {
    const { html, text } = await renderEmail(ParentPaymentBalanceCharged, PreviewProps)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.balanceAmount)
    expect(html).toContain(PreviewProps.startDate)
    expect(text).toContain(PreviewProps.balanceAmount)
  })
})
