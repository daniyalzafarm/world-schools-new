import { describe, expect, it } from 'vitest'
import { NotificationCategory } from '@world-schools/wc-types'
import {
  audienceFromRows,
  categoryCascadeItems,
  categoryDescription,
  deriveCategoryToggleState,
  type PreferenceRow,
} from './notification-preferences-page'

function row(
  templateKey: string,
  enabled: boolean,
  transactional: boolean,
  channel: 'in_app' | 'email' = 'email'
): PreferenceRow {
  return {
    templateKey,
    channel,
    enabled,
    transactional,
    category: NotificationCategory.Booking,
    label: templateKey,
    description: '',
  }
}

describe('deriveCategoryToggleState', () => {
  it('treats an empty channel as unlocked + off (renders a placeholder)', () => {
    expect(deriveCategoryToggleState([])).toEqual({ locked: false, checked: false })
  })

  it('locks a category where every member is transactional (always-on)', () => {
    const rows = [
      row('parent.payment.depositConfirmed', true, true),
      row('parent.payment.balanceCharged', true, true),
    ]
    expect(deriveCategoryToggleState(rows)).toEqual({ locked: true, checked: true })
  })

  it('keeps a mixed category (e.g. Booking) toggleable, on while any optional member is enabled', () => {
    const rows = [
      row('parent.booking.accepted', true, true), // transactional confirmation
      row('parent.checkout.abandoned3h', true, false), // optional nudge
      row('parent.preCamp.dayBefore', false, false), // optional nudge, off
    ]
    expect(deriveCategoryToggleState(rows)).toEqual({ locked: false, checked: true })
  })

  it('shows a mixed category as off once all optional members are disabled', () => {
    const rows = [
      row('parent.booking.accepted', true, true),
      row('parent.checkout.abandoned3h', false, false),
      row('parent.preCamp.dayBefore', false, false),
    ]
    expect(deriveCategoryToggleState(rows)).toEqual({ locked: false, checked: false })
  })
})

describe('categoryCascadeItems', () => {
  it('cascades only to non-transactional members, carrying the new enabled value', () => {
    const rows = [
      row('parent.booking.accepted', true, true, 'email'), // skipped (transactional)
      row('parent.checkout.abandoned3h', true, false, 'email'),
      row('parent.preCamp.dayBefore', true, false, 'email'),
    ]
    expect(categoryCascadeItems(rows, false)).toEqual([
      { templateKey: 'parent.checkout.abandoned3h', channel: 'email', enabled: false },
      { templateKey: 'parent.preCamp.dayBefore', channel: 'email', enabled: false },
    ])
  })

  it('returns nothing for a fully-transactional (locked) category', () => {
    const rows = [row('parent.payment.depositConfirmed', true, true)]
    expect(categoryCascadeItems(rows, false)).toEqual([])
  })
})

describe('audienceFromRows', () => {
  it.each([
    ['parent.booking.accepted', 'parent'],
    ['provider.booking.requestReceived', 'provider'],
    ['superadmin.payout.failure', 'superadmin'],
  ])('derives the audience from the %s templateKey prefix', (templateKey, expected) => {
    expect(audienceFromRows([row(templateKey, true, false)])).toBe(expected)
  })

  it('returns null for empty rows or an unknown prefix', () => {
    expect(audienceFromRows([])).toBeNull()
    expect(audienceFromRows([row('weird.something', true, false)])).toBeNull()
  })
})

describe('categoryDescription', () => {
  it('uses the audience-specific copy when available', () => {
    // Superadmin Bookings must NOT read like a parent receiving all their bookings.
    const desc = categoryDescription(NotificationCategory.Booking, 'superadmin')
    expect(desc).toContain('non-payment')
    expect(desc).not.toBe('Updates about your camp bookings')
  })

  it('differs per audience for the same category', () => {
    const parent = categoryDescription(NotificationCategory.Booking, 'parent')
    const superadmin = categoryDescription(NotificationCategory.Booking, 'superadmin')
    expect(parent).not.toBe(superadmin)
  })

  it('falls back to the generic description for an unknown audience or unmapped category', () => {
    expect(categoryDescription(NotificationCategory.Payment, null)).toBe(
      'Payment receipts, reminders, and confirmations'
    )
    // Wishlist isn't in the superadmin map → generic fallback.
    expect(categoryDescription(NotificationCategory.Wishlist, 'superadmin')).toBe(
      'Wishlist activity and follow-ups'
    )
  })
})
