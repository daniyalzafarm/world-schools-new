import type { MetadataRoute } from 'next'

import config from '@/config/config'
import { getPublishedCampsServer } from '@/services/camps.server'

/**
 * Camp profile sitemap, generated from published camps. Revalidated hourly.
 *
 * Note: like robots.txt, exposing this at `world-camps.org/sitemap.xml` requires
 * a Pagely proxy rule (root paths default to WordPress). Coordinate so Google
 * discovers `world-camps.org/camp/<slug>` URLs.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.app.metadataBase.replace(/\/+$/, '')

  let camps: Awaited<ReturnType<typeof getPublishedCampsServer>> = []
  try {
    camps = await getPublishedCampsServer()
  } catch {
    camps = []
  }

  return camps.map(camp => ({
    url: `${base}/camp/${camp.slug}`,
    lastModified: camp.updatedAt ?? camp.publishedAt ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))
}
