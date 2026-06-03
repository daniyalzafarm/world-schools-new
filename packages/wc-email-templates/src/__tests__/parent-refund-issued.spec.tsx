import { describe, expect, it } from 'vitest'
import ParentRefundIssued, { PreviewProps } from '../../emails/refund/parent-refund-issued'
import { renderEmail } from '../lib/renderer'

describe('ParentRefundIssued', () => {
  it('includes refund amount + ETA + reason label and booking ref', async () => {
    const { html, text } = await renderEmail(ParentRefundIssued, PreviewProps)
    expect(html).toContain(PreviewProps.refundAmount)
    expect(html).toContain(PreviewProps.refundEta)
    expect(html).toContain(PreviewProps.bookingRef)
    if (PreviewProps.reasonLabel) {
      expect(html).toContain(PreviewProps.reasonLabel)
    }
    expect(text).toContain(PreviewProps.refundAmount)
  })

  it('omits the reason line when reasonLabel is null', async () => {
    const { html } = await renderEmail(ParentRefundIssued, {
      ...PreviewProps,
      reasonLabel: null,
    })
    expect(html).not.toContain('Reason:')
  })
})
