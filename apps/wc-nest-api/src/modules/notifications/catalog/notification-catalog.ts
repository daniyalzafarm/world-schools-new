import type { NotificationType } from '@world-schools/wc-types'
import { parentCatalog } from './audiences/parent.catalog'
import { providerCatalog } from './audiences/provider.catalog'
import { superadminCatalog } from './audiences/superadmin.catalog'
import type { CatalogEntry } from './types'

/**
 * Flat keyed registry of every notification trigger. Built by merging the
 * per-audience catalogs at module load — the per-audience files keep the
 * code reviewable in domain-sized chunks while this map gives the
 * dispatcher, worker, and tests a single lookup point.
 *
 * The map is `Partial<Record<NotificationType, ...>>` while the catalog
 * is built out (legacy types and yet-to-add types are absent);
 * once complete, the partial wrapper can be tightened to
 * `Record` and the catalog validation test pinned to exhaustiveness.
 */
function buildCatalog(): Partial<Record<NotificationType, CatalogEntry<unknown>>> {
  const all: CatalogEntry<unknown>[] = [...parentCatalog, ...providerCatalog, ...superadminCatalog]
  const map: Partial<Record<NotificationType, CatalogEntry<unknown>>> = {}
  for (const entry of all) {
    if (map[entry.type]) {
      throw new Error(
        `Duplicate catalog entry for ${entry.type} (templateKey=${entry.templateKey}). ` +
          `Each NotificationType must map to exactly one CatalogEntry.`
      )
    }
    map[entry.type] = entry
  }
  return map
}

export const notificationCatalog = buildCatalog()

export function getCatalogEntry(
  type: NotificationType | string
): CatalogEntry<unknown> | undefined {
  return notificationCatalog[type as NotificationType]
}

export function listCatalogEntries(): CatalogEntry<unknown>[] {
  return Object.values(notificationCatalog).filter((e): e is CatalogEntry<unknown> => e != null)
}
