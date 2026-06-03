import { describe, expect, it } from 'vitest'
import ParentBookingAccepted from '../../emails/booking/parent-booking-accepted'
import ParentBookingDeclined from '../../emails/booking/parent-booking-declined'
import ParentPaymentBalanceCharged from '../../emails/payment/parent-payment-balance-charged'
import ParentRefundIssued from '../../emails/refund/parent-refund-issued'
import { renderEmail } from '../lib/renderer'

/**
 * Phase 14c — XSS defense regression test.
 *
 * React Email escapes all interpolated values by default; this spec guards
 * against a future regression where someone introduces `dangerouslySetInnerHTML`
 * to render bullet-list copy or a footer link, and accidentally lets a
 * provider-supplied string through unescaped.
 *
 * Sample of four representative templates (booking / payment / refund /
 * decline-reason). Adding a new template that fails this check means it
 * has an unescaped sink — fix the template, don't add an exception.
 */

const HOSTILE = '<script>alert("xss")</script><img src=x onerror=alert(1)>'

interface RenderableTemplate {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any
  props: Record<string, unknown>
}

const TEMPLATES: RenderableTemplate[] = [
  {
    name: 'ParentBookingAccepted',
    component: ParentBookingAccepted,
    props: {
      salutation: 'hi',
      firstName: HOSTILE,
      childName: HOSTILE,
      campName: HOSTILE,
      programName: HOSTILE,
      startDate: 'July 15 2026',
      bookingRef: HOSTILE,
      depositPaid: '$500',
      balanceAmount: '$1000',
      balanceDueDate: 'July 1 2026',
      bookingUrl: '/bookings/safe',
    },
  },
  {
    name: 'ParentBookingDeclined',
    component: ParentBookingDeclined,
    props: {
      salutation: 'hi',
      firstName: HOSTILE,
      childName: HOSTILE,
      campName: HOSTILE,
      reason: HOSTILE,
      browseUrl: '/camps',
    },
  },
  {
    name: 'ParentPaymentBalanceCharged',
    component: ParentPaymentBalanceCharged,
    props: {
      salutation: 'hi',
      firstName: HOSTILE,
      bookingRef: HOSTILE,
      campName: HOSTILE,
      childName: HOSTILE,
      amount: '$1000',
      chargedAt: 'July 1 2026',
      receiptUrl: '/bookings/safe',
    },
  },
  {
    name: 'ParentRefundIssued',
    component: ParentRefundIssued,
    props: {
      salutation: 'dear',
      firstName: HOSTILE,
      bookingRef: HOSTILE,
      amount: '$500',
      currency: 'USD',
      expectedArrival: 'July 5 2026',
      bookingUrl: '/bookings/safe',
    },
  },
]

describe('XSS injection regression — every sampled template escapes hostile props', () => {
  for (const { name, component, props } of TEMPLATES) {
    it(`${name}: <script> tags and event handlers cannot execute`, async () => {
      const { html } = await renderEmail(component, props as never, {
        includePlainText: true,
      })

      // The hostile payload contains both <script> and <img onerror=>. The
      // failure mode for an XSS hole would be either rendered as an actual
      // element. We assert NEITHER element exists in the output.
      //
      // Why regex: a literal `<img` in the rendered HTML is fine if it's
      // part of the template's own markup; what we forbid is an `<img`
      // element with `onerror=` as an attribute, OR a literal `<script>`
      // tag. React's JSX-escape turns `<` to `&lt;` in interpolated values
      // so neither pattern should ever match.
      expect(html).not.toMatch(/<script[\s>]/i)
      expect(html).not.toMatch(/<img[^>]*onerror\s*=/i)

      // The escaped form should be present whenever the field gets rendered.
      // We don't require it (some fields are display-only and may not appear
      // in the output), just confirm no unescaped sink exists.
    })
  }

  it('renderEmail itself does not unwrap props it receives', async () => {
    const { html } = await renderEmail(ParentBookingAccepted, {
      salutation: 'hi',
      firstName: '<b>hi</b>',
      childName: 'normal',
      campName: 'Camp',
      programName: 'Prog',
      startDate: 'date',
      bookingRef: 'ref',
      depositPaid: '$0',
      balanceAmount: '$0',
      balanceDueDate: 'date',
      bookingUrl: '/x',
    } as never)
    // Bold tag was provided as a value; must appear escaped, never as a
    // real <b> in the rendered output.
    expect(html).not.toMatch(/<b>hi<\/b>/)
  })
})
