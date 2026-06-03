import { describe, expect, it } from 'vitest'
import ParentPaymentBalanceReminder, {
  PreviewProps,
} from '../../emails/payment/parent-payment-balance-reminder'
import { renderEmail } from '../lib/renderer'

describe('ParentPaymentBalanceReminder', () => {
  for (const days of [14, 7, 3] as const) {
    it(`renders the ${days}-day cadence with the day count + amount + due date`, async () => {
      const { html, text } = await renderEmail(ParentPaymentBalanceReminder, {
        ...PreviewProps,
        daysUntilDue: days,
      })
      expect(html).toContain(`${days} days`)
      expect(html).toContain(PreviewProps.balanceAmount)
      expect(html).toContain(PreviewProps.balanceDueDate)
      expect(html).toContain(PreviewProps.bookingRef)
      expect(text).toContain(PreviewProps.balanceAmount)
    })
  }
})
