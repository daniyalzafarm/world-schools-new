import { describe, expect, it } from 'vitest'
import ParentPaymentBalanceFailed, {
  PreviewProps,
} from '../../emails/payment/parent-payment-balance-failed'
import { renderEmail } from '../lib/renderer'

describe('ParentPaymentBalanceFailed', () => {
  for (const stage of ['first', 'second', 'final'] as const) {
    it(`renders the ${stage}-stage copy with formal salutation + decline reason`, async () => {
      const { html } = await renderEmail(ParentPaymentBalanceFailed, {
        ...PreviewProps,
        stage,
      })
      expect(html).toContain(PreviewProps.bookingRef)
      expect(html).toContain(PreviewProps.balanceAmount)
      // Formal "Dear" salutation per spec for payment-failure copy.
      expect(html).toContain('Dear')
      if (PreviewProps.declineReason) {
        expect(html).toContain(PreviewProps.declineReason)
      }
    })
  }

  it('hides the retry-deadline line when stage is final', async () => {
    const { html } = await renderEmail(ParentPaymentBalanceFailed, {
      ...PreviewProps,
      stage: 'final',
      retryDeadline: '24 May 2026',
    })
    expect(html).not.toContain('Update by:')
  })

  it('shows the retry-deadline line on first/second stages', async () => {
    const { html } = await renderEmail(ParentPaymentBalanceFailed, {
      ...PreviewProps,
      stage: 'second',
      retryDeadline: '24 May 2026',
    })
    expect(html).toContain('Update by:')
    expect(html).toContain('24 May 2026')
  })
})
