import { describe, expect, it } from 'vitest'
import ParentBookingRequestSubmitted, {
  PreviewProps,
} from '../../emails/booking/parent-booking-request-submitted'
import { renderEmail } from '../lib/renderer'

describe('ParentBookingRequestSubmitted', () => {
  it('renders the 72h confirmation deadline + dynamic values', async () => {
    const { html, text } = await renderEmail(ParentBookingRequestSubmitted, PreviewProps)
    expect(html).toContain('72 hours')
    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.programName)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.bookingUrl)
    expect(text).toContain(PreviewProps.bookingRef)
  })

  it('falls back to "Hi there," when firstName missing', async () => {
    const { html } = await renderEmail(ParentBookingRequestSubmitted, {
      ...PreviewProps,
      firstName: null,
    })
    expect(html).toContain('Hi there,')
  })
})
