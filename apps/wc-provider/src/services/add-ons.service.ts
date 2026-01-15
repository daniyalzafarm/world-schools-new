import apiClient from '@/utils/api-client'
import type { AddOn, CreateAddOnDto, QueryAddOnsDto, UpdateAddOnDto } from '@/types/add-ons'

const BASE_URL = '/provider/add-ons'

export interface AddOnsResponse {
  addOns: AddOn[]
}

export interface AddOnResponse {
  addOn: AddOn
}

/**
 * Get all add-ons for the provider
 */
export async function getAddOns(query?: QueryAddOnsDto): Promise<AddOnsResponse> {
  const params = new URLSearchParams()

  if (query?.type) params.append('type', query.type)
  if (query?.isActive !== undefined) params.append('isActive', query.isActive)
  if (query?.search) params.append('search', query.search)

  const queryString = params.toString()
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL

  const response = await apiClient.get<AddOnsResponse>(url)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as AddOnsResponse
}

/**
 * Get a single add-on
 */
export async function getAddOn(id: string): Promise<AddOnResponse> {
  const response = await apiClient.get<AddOnResponse>(`${BASE_URL}/${id}`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as AddOnResponse
}

/**
 * Create a new add-on
 */
export async function createAddOn(data: CreateAddOnDto): Promise<AddOnResponse> {
  const response = await apiClient.post<AddOnResponse>(BASE_URL, data)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as AddOnResponse
}

/**
 * Update an add-on
 */
export async function updateAddOn(id: string, data: UpdateAddOnDto): Promise<AddOnResponse> {
  const response = await apiClient.patch<AddOnResponse>(`${BASE_URL}/${id}`, data)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as AddOnResponse
}

/**
 * Delete an add-on
 */
export async function deleteAddOn(id: string): Promise<{ message: string }> {
  const response = await apiClient.del(`${BASE_URL}/${id}`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as { message: string }
}

/**
 * Bulk update sort order
 */
export async function updateAddOnsSortOrder(
  updates: { id: string; sortOrder: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, sortOrder }) => apiClient.patch(`${BASE_URL}/${id}`, { sortOrder }))
  )
}
