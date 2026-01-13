import apiClient from '@/utils/api-client'
import type { AddOn } from '@/types/add-ons'

const BASE_URL = '/provider/camps'

export interface CampAddOn extends AddOn {
  isEnabled: boolean
  campSortOrder: number
}

export interface CampAddOnsResponse {
  addOns: CampAddOn[]
}

export interface UpdateCampAddOnItem {
  addOnId: string
  isEnabled: boolean
  sortOrder?: number
}

export interface UpdateCampAddOnsDto {
  addOns: UpdateCampAddOnItem[]
}

/**
 * Get all add-ons for a camp with their enabled status
 */
export async function getCampAddOns(campId: string): Promise<CampAddOnsResponse> {
  const response = await apiClient.get<CampAddOnsResponse>(`${BASE_URL}/${campId}/addons`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as CampAddOnsResponse
}

/**
 * Update camp add-ons (enable/disable and reorder)
 */
export async function updateCampAddOns(
  campId: string,
  data: UpdateCampAddOnsDto
): Promise<{ message: string }> {
  const response = await apiClient.patch(`${BASE_URL}/${campId}/addons`, data)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as { message: string }
}
