import 'server-only'

import config from '@/config/config'
import type { Camp } from '@/types/camps'
import type { CampReviewsData } from '@/types/reviews'
import type { CampBookingAddOn } from '@/types/camp-booking'

/**
 * Server-side data fetchers for the public camp profile page.
 *
 * The browser `apiClient` depends on `localStorage`/`document` and isn't usable
 * in Server Components, so these hit the public camp endpoints directly with
 * `fetch`. Responses are cached in Next's Data Cache (revalidated hourly) for
 * normal requests, and bypassed for provider draft previews.
 */

const REVALIDATE_SECONDS = 3600

// `API_BASE_URL` may or may not carry a trailing slash; normalize to none so we
// can safely concatenate `/user/...` paths.
function apiBase(): string {
  return config.app.apiUrl.replace(/\/+$/, '')
}

async function getJson<T>(path: string, opts?: { preview?: boolean }): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: 'application/json' },
    ...(opts?.preview ? { cache: 'no-store' } : { next: { revalidate: REVALIDATE_SECONDS } }),
  })
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`)
  }
  return (await res.json()) as T
}

/** Public camp by slug. `previewToken` surfaces unpublished/draft camps (uncached). */
export async function getCampBySlugServer(slug: string, previewToken?: string): Promise<Camp> {
  const qs = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : ''
  const data = await getJson<{ camp: Camp }>(`/user/camps/slug/${encodeURIComponent(slug)}${qs}`, {
    preview: !!previewToken,
  })
  return data.camp
}

/** Published reviews + aggregated scores for a camp. */
export async function getCampReviewsServer(campId: string): Promise<CampReviewsData> {
  return getJson<CampReviewsData>(`/user/camps/${campId}/reviews`)
}

/** Active add-ons for a camp. */
export async function getCampAddOnsServer(campId: string): Promise<CampBookingAddOn[]> {
  const data = await getJson<CampBookingAddOn[]>(`/user/camps/${campId}/addons`)
  return Array.isArray(data) ? data : []
}

/** All published camps (used by the sitemap). */
export async function getPublishedCampsServer(): Promise<Camp[]> {
  const data = await getJson<{ camps: Camp[] }>(`/user/camps`)
  return data.camps ?? []
}
