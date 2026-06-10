import { listCatalogEntries } from '../catalog/notification-catalog'
import { NOTIFICATION_SETTINGS_COPY } from '../preferences/notification-settings-copy'

/**
 * Drift guard for the notification-settings copy. Uses the REAL catalog (not a
 * mock) so a notification can't ship without curated settings-UI copy, and so
 * stale copy can't linger after a notification is removed.
 */
describe('NOTIFICATION_SETTINGS_COPY', () => {
  const entries = listCatalogEntries()

  it('covers every registered notification (no missing copy)', () => {
    const missing = entries.map(e => e.templateKey).filter(k => !NOTIFICATION_SETTINGS_COPY[k])
    expect(missing).toEqual([])
  })

  it('has a non-empty label + description for every entry', () => {
    const blank = Object.entries(NOTIFICATION_SETTINGS_COPY)
      .filter(([, copy]) => !copy.label?.trim() || !copy.description?.trim())
      .map(([key]) => key)
    expect(blank).toEqual([])
  })

  it('has no stale copy keys that no longer map to a registered notification', () => {
    const registered = new Set(entries.map(e => e.templateKey))
    const stale = Object.keys(NOTIFICATION_SETTINGS_COPY).filter(k => !registered.has(k))
    expect(stale).toEqual([])
  })
})
