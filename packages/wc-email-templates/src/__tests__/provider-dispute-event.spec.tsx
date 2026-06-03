import { describe, expect, it } from 'vitest'
import ProviderDisputeEvent, {
  PreviewProps,
} from '../../emails/provider/dispute/provider-dispute-event'
import { renderEmail } from '../lib/renderer'

describe('ProviderDisputeEvent', () => {
  for (const kind of ['opened', 'evidenceDue', 'resolvedWon', 'resolvedLost'] as const) {
    it(`renders the ${kind} kind with disputed amount + booking ref`, async () => {
      const { html } = await renderEmail(ProviderDisputeEvent, { ...PreviewProps, kind })
      expect(html).toContain(PreviewProps.amount)
      expect(html).toContain(PreviewProps.bookingRef)
      expect(html).toContain(PreviewProps.companyName)
    })
  }

  it('includes the evidence-due label on opened + evidenceDue', async () => {
    const { html } = await renderEmail(ProviderDisputeEvent, {
      ...PreviewProps,
      kind: 'opened',
    })
    expect(html).toContain(PreviewProps.evidenceDueLabel ?? '')
  })

  it('omits the evidence-due line on resolvedWon/Lost', async () => {
    const { html } = await renderEmail(ProviderDisputeEvent, {
      ...PreviewProps,
      kind: 'resolvedWon',
      evidenceDueLabel: null,
    })
    expect(html).not.toContain('Evidence due')
  })
})
