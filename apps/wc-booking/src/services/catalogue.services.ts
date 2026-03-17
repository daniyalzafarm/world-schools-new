/**
 * Public catalogue API for parent app — categories (interests) and activities/scales (skills).
 */

import apiClient from '@/utils/api-client'

export interface CatalogueCategory {
  id: string
  slug: string
  name: string
  emoji?: string | null
  order: number
  activities: {
    id: string
    slug: string
    name: string
    emoji?: string | null
    scaleId?: string | null
  }[]
}

export interface CatalogueActivityWithScale {
  id: string
  name: string
  emoji?: string | null
  scaleId?: string | null
  category?: { id: string; name: string }
}

export interface ScaleLevel {
  id: string
  value: string
  label: string
  order: number
}

export interface CatalogueScale {
  id: string
  name: string
  levels: ScaleLevel[]
}

/** Categories for parent interests (surface=parentInterests) */
export async function getCategoriesForParent(): Promise<CatalogueCategory[]> {
  const res = await apiClient.get<CatalogueCategory[]>(
    '/catalogue/categories?status=active&surface=parentInterests'
  )
  if (!res.success) return []
  const data = (res.data as any)?.data ?? res.data
  return Array.isArray(data) ? data : []
}

/** Activities that have a scale (for skill picker) */
export async function getActivities(params?: {
  hasScale?: boolean
  surface?: 'parentInterests' | 'campFocus' | 'campInterests'
}): Promise<CatalogueActivityWithScale[]> {
  const qp = new URLSearchParams()
  qp.set('hasScale', String(params?.hasScale ?? true))
  params?.surface && qp.set('surface', params?.surface)

  const res = await apiClient.get<CatalogueActivityWithScale[]>(
    `/catalogue/activities?${qp.toString()}`
  )
  if (!res.success) return []
  const data = (res.data as any)?.data ?? res.data
  return Array.isArray(data) ? data : []
}

/** All scales with levels */
export async function getScales(): Promise<CatalogueScale[]> {
  const res = await apiClient.get<CatalogueScale[]>('/catalogue/scales')
  if (!res.success) return []
  const data = (res.data as any)?.data ?? res.data
  return Array.isArray(data) ? data : []
}
