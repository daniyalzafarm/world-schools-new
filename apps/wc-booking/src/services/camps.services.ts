import apiClient from '@/utils/api-client'
import type { Camp } from '@/types/camps'

/**
 * Get a camp by its slug (public endpoint - no auth required)
 */
export async function getCampBySlug(slug: string, previewToken?: string): Promise<Camp> {
  const url = previewToken
    ? `/user/camps/slug/${slug}?preview=${previewToken}`
    : `/user/camps/slug/${slug}`
  const response = await apiClient.get<{ camp: Camp }>(url)
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

/**
 * Get all published camps (public endpoint - no auth required)
 */
export async function getPublishedCamps(): Promise<Camp[]> {
  const response = await apiClient.get<{ camps: Camp[] }>('/user/camps')
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camps
}
