import { describe, expect, it } from 'vitest'
import ParentDisputeOpened, { PreviewProps } from '../../emails/dispute/parent-dispute-opened'
import { renderEmail } from '../lib/renderer'

describe('ParentDisputeOpened', () => {
  it('uses formal salutation + states the disputed amount + booking ref', async () => {
    const { html } = await renderEmail(ParentDisputeOpened, PreviewProps)
    expect(html).toContain('Dear')
    expect(html).toContain(PreviewProps.disputeAmount)
    expect(html).toContain(PreviewProps.bookingRef)
    expect(html).toContain(PreviewProps.campName)
  })
})
