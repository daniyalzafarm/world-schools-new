import { describe, expect, it } from 'vitest'
import ProviderRefundEvent, {
  PreviewProps,
} from '../../emails/provider/refund/provider-refund-event'
import { renderEmail } from '../lib/renderer'

describe('ProviderRefundEvent', () => {
  for (const kind of ['issued', 'failed', 'reimbursementOwed'] as const) {
    it(`renders the ${kind} kind with amount + booking ref`, async () => {
      const { html } = await renderEmail(ProviderRefundEvent, { ...PreviewProps, kind })
      expect(html).toContain(PreviewProps.amount)
      expect(html).toContain(PreviewProps.bookingRef)
      expect(html).toContain(PreviewProps.companyName)
    })
  }

  it('renders gracefully with no reason on failed', async () => {
    const { html } = await renderEmail(ProviderRefundEvent, {
      ...PreviewProps,
      kind: 'failed',
      reason: null,
    })
    expect(html).toContain(PreviewProps.amount)
  })
})
