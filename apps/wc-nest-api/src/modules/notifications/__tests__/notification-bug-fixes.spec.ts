import { NotificationType } from '@world-schools/wc-types'
import { getCatalogEntry } from '../catalog/notification-catalog'
import { propLoaders } from '../resolvers/prop-loaders'
import type { PrismaService } from '../../../prisma/prisma.service'

/**
 * Regression coverage for the notification-bugs.md fixes.
 *
 * The render assertions exercise the catalog entries' pure title/body/
 * subject/redirectUrl builders directly (no DB). The loader assertions mock
 * a minimal Prisma so the DB-backed fixes (BUG-166 expiry race, BUG-190 child
 * name) are pinned.
 */

function entry(type: NotificationType) {
  const e = getCatalogEntry(type)
  if (!e) throw new Error(`No catalog entry registered for ${type}`)
  return e
}

// Render helpers tolerate the catalog's `unknown` prop typing in tests.
const render = {
  title: (type: NotificationType, props: unknown) => entry(type).inApp?.title(props as never),
  body: (type: NotificationType, props: unknown) => entry(type).inApp?.body(props as never),
  redirect: (type: NotificationType, props: unknown) =>
    entry(type).inApp?.redirectUrl(props as never, {}),
  subject: (type: NotificationType, props: unknown) => entry(type).email?.subject(props as never),
}

describe('notification bug fixes', () => {
  describe('BUG-168/169/170 — provider booking in-app renders camp + reference (not undefined)', () => {
    const props = {
      bookingGroupId: 'bg-1',
      bookingGroupNumber: 'WC-2026-0001',
      campName: 'Nike Golf Camps',
      bookingUrl: 'https://provider.test/bookings/bg-1',
    }
    it.each([
      NotificationType.ProviderBookingRequestReceived,
      NotificationType.ProviderBookingAccepted,
      NotificationType.ProviderBookingDeclined,
    ])('%s title/body contain real values', type => {
      const title = render.title(type, props) ?? ''
      const body = render.body(type, props) ?? ''
      const combined = `${title} ${body}`
      // campName + booking reference appear across the title/body (which one
      // carries which differs per entry); the regression is that neither is
      // ever the literal "undefined".
      expect(combined).toContain('Nike Golf Camps')
      expect(combined).toContain('WC-2026-0001')
      expect(combined).not.toContain('undefined')
    })
  })

  describe('BUG-179 — provider.booking.requestReceived also sends email', () => {
    it('declares the email channel + a campName subject', () => {
      const e = entry(NotificationType.ProviderBookingRequestReceived)
      expect(e.channels).toContain('email')
      expect(e.email).toBeDefined()
      expect(
        render.subject(NotificationType.ProviderBookingRequestReceived, {
          campName: 'Nike Golf Camps',
        })
      ).toContain('Nike Golf Camps')
    })
  })

  describe('BUG-187 — provider.booking.requestWithdrawn also sends email', () => {
    it('declares the email channel', () => {
      expect(entry(NotificationType.ProviderBookingRequestWithdrawn).channels).toContain('email')
    })
  })

  describe('BUG-184 — parent.booking.requestWithdrawn re-engagement + browse CTA', () => {
    const props = { campName: 'Nike Golf Camps', programName: '1-week camp' }
    it('body includes the re-engagement sentence', () => {
      expect(render.body(NotificationType.ParentBookingRequestWithdrawn, props)).toContain(
        'submit a new request at any time'
      )
    })
    it('redirects to browse programs, not the dead booking', () => {
      expect(render.redirect(NotificationType.ParentBookingRequestWithdrawn, props)).toBe('/camps')
    })
  })

  describe('BUG-190 — parent.booking.declined names the child', () => {
    it('in-app body includes the child name', () => {
      const body = render.body(NotificationType.ParentBookingDeclined, {
        childName: 'Emma',
        campName: 'Nike Golf Camps',
        sessionRange: '12–26 Jul 2026',
      })
      expect(body).toContain('Emma')
    })
  })

  describe('BUG-189 — provider.booking.cancelledByFamily surfaces the financial detail', () => {
    it('in-app body renders the threaded detail, not just the program', () => {
      const detail =
        "Emma's place was cancelled. Refund of USD 1950.00 issued to the family; Acme retains USD 50.00 under the cancellation policy."
      const body = render.body(NotificationType.ProviderBookingCancelledByFamily, {
        bookingRef: 'WC-2026-0001',
        programName: '1-week camp',
        detail,
      })
      expect(body).toBe(detail)
    })
  })

  describe('BUG-171-175 — superadmin redirect builders are null-safe', () => {
    it.each([
      NotificationType.SuperadminCampStripeDisconnected,
      NotificationType.SuperadminDisputeResolved,
      NotificationType.SuperadminFundsPendingTransfer,
    ])('%s does not throw and falls back to / when reviewUrl is missing', type => {
      // props present but reviewUrl undefined — the pre-fix builder crashed here.
      expect(() => render.redirect(type, { companyName: 'Acme' })).not.toThrow()
      expect(render.redirect(type, { companyName: 'Acme' })).toBe('/')
    })
  })
})

describe('notification loader fixes', () => {
  function mockPrisma(row: unknown): PrismaService {
    return {
      bookingGroup: { findUnique: jest.fn().mockResolvedValue(row) },
    } as unknown as PrismaService
  }

  const baseRow = {
    bookingGroupNumber: 'WC-2026-0001',
    parent: { user: { firstName: 'Sarah' } },
    camp: { name: 'Nike Golf Camps' },
    session: { name: '1-week camp', startDate: new Date('2026-07-12') },
    bookings: [{ child: { firstName: 'Emma' } }],
  }

  describe('BUG-166 — ParentBookingExpired loader fires once the request has lapsed', () => {
    const load = propLoaders[NotificationType.ParentBookingExpired]

    it('returns props (with camp name) when the booking already flipped to expired', async () => {
      const props = (await load(mockPrisma({ ...baseRow, status: 'expired', expiresAt: null }), {
        bookingGroupId: 'bg-1',
      })) as { campName: string } | null
      expect(props).not.toBeNull()
      expect(props?.campName).toBe('Nike Golf Camps')
    })

    it('fires when still `request` but the deadline has passed (cron not yet ticked)', async () => {
      const past = new Date(Date.now() - 60_000)
      const props = await load(mockPrisma({ ...baseRow, status: 'request', expiresAt: past }), {
        bookingGroupId: 'bg-1',
      })
      expect(props).not.toBeNull()
    })

    it('does NOT fire for an extended request whose deadline is still in the future', async () => {
      const future = new Date(Date.now() + 60 * 60_000)
      const props = await load(mockPrisma({ ...baseRow, status: 'request', expiresAt: future }), {
        bookingGroupId: 'bg-1',
      })
      expect(props).toBeNull()
    })

    it('does NOT fire once the booking was accepted', async () => {
      const props = await load(mockPrisma({ ...baseRow, status: 'accepted', expiresAt: null }), {
        bookingGroupId: 'bg-1',
      })
      expect(props).toBeNull()
    })
  })

  describe('BUG-190 — parent.booking.declined loader includes the child name', () => {
    it('maps bookings[0].child.firstName to childName', async () => {
      const load = propLoaders[NotificationType.ParentBookingDeclined]
      const props = (await load(
        mockPrisma({
          ...baseRow,
          declineReason: null,
          session: { ...baseRow.session, endDate: new Date('2026-07-19') },
        }),
        { bookingGroupId: 'bg-1' }
      )) as { childName: string } | null
      expect(props?.childName).toBe('Emma')
    })
  })
})
