import { describe, expect, it } from 'vitest'
import ParentDisputeResolved, { PreviewProps } from '../../emails/dispute/parent-dispute-resolved'
import { renderEmail } from '../lib/renderer'

describe('ParentDisputeResolved', () => {
  for (const outcome of ['won', 'lost'] as const) {
    it(`renders the ${outcome} outcome with formal salutation + amount + booking ref`, async () => {
      const { html } = await renderEmail(ParentDisputeResolved, {
        ...PreviewProps,
        outcome,
      })
      expect(html).toContain('Dear')
      expect(html).toContain(PreviewProps.disputeAmount)
      expect(html).toContain(PreviewProps.bookingRef)
      expect(html).toContain(PreviewProps.campName)
      // Outcome-specific copy distinguishes the two paths.
      if (outcome === 'won') {
        expect(html).toContain('charge stands')
      } else {
        expect(html).toContain('refunded')
      }
    })
  }
})
