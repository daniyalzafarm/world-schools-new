import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CATEGORY,
  assertNotificationCategoryExhaustiveness,
  categoryFor,
  findUnmappedNotificationTypes,
} from './notification-categories'
import { NotificationCategory, NotificationType } from './websocket.types'

describe('NOTIFICATION_CATEGORY map (exhaustiveness gate)', () => {
  it('covers every NotificationType enum member — no silent System fallthrough', () => {
    expect(findUnmappedNotificationTypes()).toEqual([])
  })

  it('assertNotificationCategoryExhaustiveness() does not throw', () => {
    expect(() => assertNotificationCategoryExhaustiveness()).not.toThrow()
  })

  it('every mapped category is a known NotificationCategory enum value', () => {
    const validCategories = new Set(Object.values(NotificationCategory))
    for (const [key, value] of Object.entries(NOTIFICATION_CATEGORY)) {
      expect(validCategories.has(value as NotificationCategory)).toBe(true)
      expect(typeof key).toBe('string')
    }
  })

  describe('categoryFor()', () => {
    it('returns the mapped category for a registered type', () => {
      expect(categoryFor(NotificationType.ParentBookingAccepted)).toBe(NotificationCategory.Booking)
    })

    it('returns NotificationCategory.System for an unknown string', () => {
      expect(categoryFor('totally.bogus.key')).toBe(NotificationCategory.System)
    })
  })
})
