/**
 * Public catalogue API — activities with scales and scale definitions.
 * Used by camp eligibility editor and camp focus (future).
 */

import apiClient from '@/utils/api-client'

/** Public API returns id = activity slug */
export interface CatalogueActivity {
  id: string
  name: string
  emoji?: string | null
  scaleId?: string | null
  category?: { id: string; name: string; emoji?: string | null; order: number }
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
  description?: string | null
  visualType: string
  colorKey: string
  levels: ScaleLevel[]
}

/** Activities that have a skill scale (for eligibility and skill pickers) */
export const getActivitiesWithScale = async (): Promise<CatalogueActivity[]> => {
  const response = await apiClient.get<CatalogueActivity[]>('/catalogue/activities?hasScale=true')
  if (!response.success) return []
  const data = (response.data as any)?.data ?? response.data
  return Array.isArray(data) ? data : []
}

/** All scale definitions with levels */
export const getScales = async (): Promise<CatalogueScale[]> => {
  const response = await apiClient.get<CatalogueScale[]>('/catalogue/scales')
  if (!response.success) return []
  const data = (response.data as any)?.data ?? response.data
  return Array.isArray(data) ? data : []
}
