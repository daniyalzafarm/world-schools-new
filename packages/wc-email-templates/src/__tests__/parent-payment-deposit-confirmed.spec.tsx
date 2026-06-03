import { describe, expect, it } from 'vitest'
import ParentPaymentDepositConfirmed, {
  PreviewProps,
} from '../../emails/payment/parent-payment-deposit-confirmed'
import { renderEmail } from '../lib/renderer'

describe('ParentPaymentDepositConfirmed', () => {
  it('includes booking ref, deposit, balance, and balance due date', async () => {
    const { html, text } = await renderEmail(ParentPaymentDepositConfirmed, PreviewProps)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.depositAmount)
    expect(html).toContain(PreviewProps.balanceAmount)
    expect(html).toContain(PreviewProps.balanceDueDate)
    expect(text).toContain(PreviewProps.depositAmount)
  })
})
