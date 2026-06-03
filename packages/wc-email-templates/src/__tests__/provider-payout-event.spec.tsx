import { describe, expect, it } from 'vitest'
import ProviderPayoutEvent, {
  PreviewProps,
} from '../../emails/provider/payouts/provider-payout-event'
import { renderEmail } from '../lib/renderer'

describe('ProviderPayoutEvent', () => {
  for (const kind of [
    'scheduleConfirmed',
    'balanceCollected',
    'reminder',
    'released',
    'failed',
    'delayed',
  ] as const) {
    it(`renders the ${kind} kind with amount + provider context`, async () => {
      const { html } = await renderEmail(ProviderPayoutEvent, { ...PreviewProps, kind })
      expect(html).toContain(PreviewProps.amount)
      expect(html).toContain(PreviewProps.companyName)
    })
  }

  it('shows the booking reference for booking-scoped events', async () => {
    const { html } = await renderEmail(ProviderPayoutEvent, {
      ...PreviewProps,
      kind: 'balanceCollected',
    })
    expect(html).toContain(PreviewProps.bookingRef ?? '')
  })

  it('includes a Stripe failure reason on failed payouts', async () => {
    const { html } = await renderEmail(ProviderPayoutEvent, {
      ...PreviewProps,
      kind: 'failed',
      reason: 'insufficient_funds',
    })
    expect(html).toContain('insufficient_funds')
  })
})
