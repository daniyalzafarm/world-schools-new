import apiClient from '@/utils/api-client'
import type { AddOn, CreateAddOnDto, QueryAddOnsDto, UpdateAddOnDto } from '@/types/add-ons'

const BASE_URL = '/provider/add-ons'

export interface AddOnsResponse {
  addOns: AddOn[]
}

export interface AddOnResponse {
  addOn: AddOn
}

export function getAddOns(query?: QueryAddOnsDto) {
  const params = new URLSearchParams()
  if (query?.type) params.append('type', query.type)
  if (query?.isActive !== undefined) params.append('isActive', query.isActive)
  if (query?.search) params.append('search', query.search)
  const queryString = params.toString()
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL
  return apiClient.get<AddOnsResponse>(url)
}

export function getAddOn(id: string) {
  return apiClient.get<AddOnResponse>(`${BASE_URL}/${id}`)
}

export function createAddOn(data: CreateAddOnDto) {
  return apiClient.post<AddOnResponse>(BASE_URL, data)
}

export function updateAddOn(id: string, data: UpdateAddOnDto) {
  return apiClient.patch<AddOnResponse>(`${BASE_URL}/${id}`, data)
}

export function deleteAddOn(id: string) {
  return apiClient.del(`${BASE_URL}/${id}`)
}

export async function updateAddOnsSortOrder(
  updates: { id: string; sortOrder: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, sortOrder }) => apiClient.patch(`${BASE_URL}/${id}`, { sortOrder }))
  )
}
