/**
 * Permissions Service for WC Provider
 *
 * Service layer for all permissions-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type { Permission, PermissionGroup } from '@world-schools/wc-types'

export type { Permission, PermissionGroup }

/**
 * Get all permissions grouped by resource
 */
export async function getPermissions(): Promise<ApiResult<PermissionGroup[]>> {
  return await apiClient.get<PermissionGroup[]>('/provider/permissions')
}
