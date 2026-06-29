import { listCatalogEntries, notificationCatalog } from './notification-catalog'
import { recipientResolvers } from '../resolvers/recipient-resolvers'
import { propLoaders } from '../resolvers/prop-loaders'

/**
 * CI guard for catalog integrity.
 *
 * These assertions catch the most common drift: a new
 * NotificationType added without a corresponding template, resolver, or
 * preference category. As the full 126-entry catalog is built out
 * incrementally, these tests scope to entries actually registered.
 */
describe('Notification Catalog', () => {
  const entries = listCatalogEntries()

  it('has at least one entry registered (proof-of-concept)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(1)
  })

  it('all templateKey values are unique', () => {
    const keys = entries.map(e => e.templateKey)
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })

  it('every entry resolver key exists in the recipient registry', () => {
    // Array form — dotted resolver keys (none today, but some may be
    // added later) would be misparsed by `toHaveProperty`'s string-path syntax.
    for (const entry of entries) {
      expect(recipientResolvers).toHaveProperty([entry.resolver])
    }
  })

  it('every entry with email/in-app rendering has a prop loader registered', () => {
    // NotificationType values use dotted namespaces (parent.booking.accepted) —
    // `toHaveProperty` parses dots as nested paths, so array form is required.
    for (const entry of entries) {
      if (entry.email || entry.inApp) {
        expect(propLoaders).toHaveProperty([entry.type as string])
      }
    }
  })

  it('NotificationType ↔ templateKey strings agree', () => {
    // Catalog convention: `templateKey` mirrors the NotificationType enum's
    // string value so logs/audit rows cross-reference cleanly.
    for (const entry of entries) {
      expect(entry.templateKey).toBe(entry.type as string)
    }
  })

  it('notificationCatalog map keys agree with their entry types', () => {
    for (const [key, entry] of Object.entries(notificationCatalog)) {
      if (entry) {
        expect(entry.type).toBe(key)
      }
    }
  })
})
