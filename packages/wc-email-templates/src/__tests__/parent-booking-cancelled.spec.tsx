import { describe, expect, it } from 'vitest'
import ParentBookingCancelled, { PreviewProps } from '../../emails/booking/parent-booking-cancelled'
import { renderEmail } from '../lib/renderer'

describe('ParentBookingCancelled', () => {
  it('includes refund amount + ETA when refund is non-empty', async () => {
    const { html, text } = await renderEmail(ParentBookingCancelled, PreviewProps)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.refundAmount)
    expect(html).toContain(PreviewProps.refundEta)
    expect(text).toContain(PreviewProps.refundAmount)
  })

  it('renders the "no refund due" copy when refundAmount is empty', async () => {
    const { html } = await renderEmail(ParentBookingCancelled, {
      ...PreviewProps,
      refundAmount: '',
    })
    expect(html).toContain('No refund is due')
    expect(html).not.toContain(PreviewProps.refundEta) // refund ETA suppressed when no refund
  })
})
