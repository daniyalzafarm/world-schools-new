import { describe, expect, it } from 'vitest'
import ParentBookingDeclined, { PreviewProps } from '../../emails/booking/parent-booking-declined'
import { renderEmail } from '../lib/renderer'

describe('ParentBookingDeclined', () => {
  it('renders HTML with all dynamic values', async () => {
    const { html, text } = await renderEmail(ParentBookingDeclined, PreviewProps)

    expect(html).toContain(PreviewProps.campName)
    expect(html).toContain(PreviewProps.programName)
    expect(html).toContain(PreviewProps.sessionRange)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.declineReason!)
    expect(html).toContain(PreviewProps.browseUrl)
    expect(text).toContain(PreviewProps.bookingRef)
  })

  it('omits the reason panel when declineReason is undefined', async () => {
    const { html } = await renderEmail(ParentBookingDeclined, {
      ...PreviewProps,
      declineReason: undefined,
    })
    expect(html).not.toContain('Reason:')
  })

  it('uses "Dear {firstName}," for formal salutation', async () => {
    const { html } = await renderEmail(ParentBookingDeclined, {
      ...PreviewProps,
      salutation: 'dear',
      firstName: 'Sarah',
    })
    expect(html).toContain('Dear Sarah,')
  })

  it('does NOT include child name (spec: child name not permitted in decline context)', async () => {
    // ParentBookingDeclinedProps has no `childName` field — this test enforces
    // that the type stays this way. If a future change adds it, GDPR data-min
    // review per the v28 spec is required.
    const { html } = await renderEmail(ParentBookingDeclined, PreviewProps)
    expect(html).not.toMatch(/\bEmma\b/) // 'Emma' is the standard PreviewProps child name
  })
})
