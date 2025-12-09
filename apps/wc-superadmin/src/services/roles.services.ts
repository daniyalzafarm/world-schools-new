/**
 * Roles Service for WC Superadmin
 *
 * Service layer for all roles-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type { CreateRoleData, Role, UpdateRoleData } from '@/types/roles'

export interface GetRolesParams {
  page?: number
  limit?: number
  search?: string
  isSystemRole?: boolean
  createdAfter?: string
  createdBefore?: string
}

/**
 * Get all system-wide roles with pagination and filtering
 */
export async function getRoles(params?: GetRolesParams): Promise<ApiResult<Role[]>> {
  const queryParams = new URLSearchParams()

  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.isSystemRole !== undefined)
    queryParams.append('isSystemRole', params.isSystemRole.toString())
  if (params?.createdAfter) queryParams.append('createdAfter', params.createdAfter)
  if (params?.createdBefore) queryParams.append('createdBefore', params.createdBefore)

  const url = queryParams.toString()
    ? `/superadmin/roles?${queryParams.toString()}`
    : '/superadmin/roles'

  return await apiClient.get<Role[]>(url)
}

/**
 * Get a single role by ID
 */
export async function getRole(id: string): Promise<ApiResult<Role>> {
  return await apiClient.get<Role>(`/superadmin/roles/${id}`)
}

/**
 * Create a new system-wide role
 */
export async function createRole(roleData: CreateRoleData): Promise<ApiResult<Role>> {
  return await apiClient.post<Role>('/superadmin/roles', roleData)
}

/**
 * Update an existing role
 */
export async function updateRole(id: string, roleData: UpdateRoleData): Promise<ApiResult<Role>> {
  return await apiClient.patch<Role>(`/superadmin/roles/${id}`, roleData)
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<ApiResult<{ message: string }>> {
  return await apiClient.del<{ message: string }>(`/superadmin/roles/${id}`)
}
