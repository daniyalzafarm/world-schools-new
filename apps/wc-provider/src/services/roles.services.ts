/**
 * Roles Service for WC Provider
 *
 * Service layer for all roles-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type { CreateRoleData, Role, UpdateRoleData } from '@/types/roles'

export interface GetRolesParams {
  page?: number
  limit?: number
  search?: string
  createdAfter?: string
  createdBefore?: string
}

/**
 * Get all provider-specific roles with pagination and filtering
 */
export async function getRoles(params?: GetRolesParams): Promise<ApiResult<Role[]>> {
  const queryParams = new URLSearchParams()

  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.createdAfter) queryParams.append('createdAfter', params.createdAfter)
  if (params?.createdBefore) queryParams.append('createdBefore', params.createdBefore)

  const url = queryParams.toString()
    ? `/provider/roles?${queryParams.toString()}`
    : '/provider/roles'

  return await apiClient.get<Role[]>(url)
}

/**
 * Get a single role by ID
 */
export async function getRole(id: string): Promise<ApiResult<Role>> {
  return await apiClient.get<Role>(`/provider/roles/${id}`)
}

/**
 * Create a new provider-specific role
 */
export async function createRole(roleData: CreateRoleData): Promise<ApiResult<Role>> {
  return await apiClient.post<Role>('/provider/roles', roleData)
}

/**
 * Update an existing role
 */
export async function updateRole(id: string, roleData: UpdateRoleData): Promise<ApiResult<Role>> {
  return await apiClient.patch<Role>(`/provider/roles/${id}`, roleData)
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<ApiResult<{ message: string }>> {
  return await apiClient.del<{ message: string }>(`/provider/roles/${id}`)
}
