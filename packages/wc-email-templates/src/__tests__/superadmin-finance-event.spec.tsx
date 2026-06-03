import { describe, expect, it } from 'vitest'
import SuperadminFinanceEvent, {
  PreviewProps,
} from '../../emails/superadmin/finance/superadmin-finance-event'
import { renderEmail } from '../lib/renderer'

describe('SuperadminFinanceEvent', () => {
  const kinds = [
    'disputeFiled',
    'disputeResolved',
    'payoutFailure',
    'payoutRecoveryNeeded',
    'fundsPendingTransfer',
    'bookingCancelledNonPayment',
  ] as const

  for (const kind of kinds) {
    it(`renders ${kind} with company + booking + amount surfaced`, async () => {
      const { html, text } = await renderEmail(
        SuperadminFinanceEvent,
        { ...PreviewProps, kind },
        { includePlainText: true }
      )
      expect(html).toContain(PreviewProps.companyName)
      if (kind !== 'payoutFailure' && kind !== 'payoutRecoveryNeeded') {
        // Per-kind body always references the bookingRef for booking-scoped
        // kinds; payoutFailure/recoveryNeeded focus on the camp + amount.
        expect(html).toContain(PreviewProps.bookingRef ?? '')
      }
      expect(html).toContain(PreviewProps.amount ?? '')
      expect(text.length).toBeGreaterThan(0)
    })
  }

  it('renders the failure reason on payoutFailure', async () => {
    const { html } = await renderEmail(SuperadminFinanceEvent, {
      ...PreviewProps,
      kind: 'payoutFailure',
      reason: 'insufficient_funds',
    })
    expect(html).toContain('insufficient_funds')
  })

  it('renders the outcome on disputeResolved', async () => {
    const { html } = await renderEmail(SuperadminFinanceEvent, {
      ...PreviewProps,
      kind: 'disputeResolved',
      outcome: 'lost',
    })
    expect(html).toContain('buyer')
  })

  it('greps clean against forbidden payment phrases', async () => {
    // Money-touching templates are the highest-risk candidates for the
    // payment-terminology language ban from the v28 spec. Smoke-check
    // here so any future copy edit is caught locally.
    const FORBIDDEN = [
      'destination charges',
      'we hold your money',
      'funds held by world camps',
      'platform escrow',
    ]
    for (const kind of kinds) {
      const { html, text } = await renderEmail(
        SuperadminFinanceEvent,
        { ...PreviewProps, kind },
        { includePlainText: true }
      )
      const haystack = `${html.toLowerCase()}\n${text.toLowerCase()}`
      for (const phrase of FORBIDDEN) {
        expect(haystack).not.toContain(phrase)
      }
    }
  })
})
