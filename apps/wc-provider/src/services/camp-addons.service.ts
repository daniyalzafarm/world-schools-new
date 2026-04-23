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

export const getCampAddOns = (campId: string) =>
  apiClient.get<CampAddOnsResponse>(`${BASE_URL}/${campId}/addons`)

export const updateCampAddOns = (campId: string, data: UpdateCampAddOnsDto) =>
  apiClient.patch<{ message: string }>(`${BASE_URL}/${campId}/addons`, data)
