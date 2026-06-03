import { describe, expect, it } from 'vitest'
import ParentRefundFailed, { PreviewProps } from '../../emails/refund/parent-refund-failed'
import { renderEmail } from '../lib/renderer'

describe('ParentRefundFailed', () => {
  it('uses formal salutation + includes amount and failure reason', async () => {
    const { html } = await renderEmail(ParentRefundFailed, PreviewProps)
    expect(html).toContain('Dear')
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.refundAmount)
    if (PreviewProps.failureReason) {
      expect(html).toContain(PreviewProps.failureReason)
    }
  })

  it('renders gracefully without a failureReason', async () => {
    const { html } = await renderEmail(ParentRefundFailed, {
      ...PreviewProps,
      failureReason: null,
    })
    expect(html).toContain(PreviewProps.refundAmount)
    expect(html).not.toContain('Reason:')
  })
})
