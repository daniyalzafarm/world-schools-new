import { describe, expect, it } from 'vitest'
import ParentBookingAccepted, { PreviewProps } from '../../emails/booking/parent-booking-accepted'
import { renderEmail } from '../lib/renderer'

describe('ParentBookingAccepted', () => {
  it('renders HTML with all dynamic values', async () => {
    const { html, text } = await renderEmail(ParentBookingAccepted, PreviewProps)

    expect(html).toContain(PreviewProps.childName)
    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.programName)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.depositPaid)
    expect(html).toContain(PreviewProps.balanceAmount)
    expect(html).toContain(PreviewProps.balanceDueDate)
    expect(html).toContain(PreviewProps.bookingUrl)

    expect(text).toContain(PreviewProps.childName)
    expect(text).toContain(PreviewProps.bookingRef)
  })

  it('applies the "Hi {firstName}," salutation for standard tone', async () => {
    const { html } = await renderEmail(ParentBookingAccepted, {
      ...PreviewProps,
      salutation: 'hi',
      firstName: 'Sarah',
    })
    expect(html).toContain('Hi Sarah,')
  })

  it('falls back to "Hi there," when firstName is missing', async () => {
    const { html } = await renderEmail(ParentBookingAccepted, {
      ...PreviewProps,
      salutation: 'hi',
      firstName: null,
    })
    expect(html).toContain('Hi there,')
  })

  it('escapes user-controlled content by default', async () => {
    const { html } = await renderEmail(ParentBookingAccepted, {
      ...PreviewProps,
      childName: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
