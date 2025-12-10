/**
 * Permissions Service for WC Provider
 *
 * Service layer for all permissions-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'

export interface Permission {
  id: string
  name: string
}

export interface PermissionGroup {
  name: string
  permissions: Permission[]
}

/**
 * Get all permissions grouped by resource
 */
export async function getPermissions(): Promise<ApiResult<PermissionGroup[]>> {
  return await apiClient.get<PermissionGroup[]>('/provider/permissions')
}
