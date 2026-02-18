import apiClient, { type ApiResult } from '@/utils/api-client'
import type { Child } from '@/types/child'

/**
 * Children API Service
 * Handles all API calls related to children management
 */
export const childrenService = {
  /**
   * Get all children for the authenticated user
   */
  async getAll(): Promise<ApiResult<Child[]>> {
    return apiClient.get<Child[]>('/user/children')
  },

  /**
   * Get a specific child by ID
   */
  async getById(id: string): Promise<ApiResult<Child>> {
    return apiClient.get<Child>(`/user/children/${id}`)
  },

  /**
   * Create a new child (minimal fields only)
   */
  async create(child: {
    firstName: string
    lastName?: string
    dateOfBirth: string
    gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
  }): Promise<ApiResult<Child>> {
    return apiClient.post<Child>('/user/children', child)
  },

  /**
   * Update an existing child
   */
  async update(
    id: string,
    updates: Partial<
      Omit<Child, 'id' | 'createdAt' | 'updatedAt' | 'parentId' | 'profileCompletion' | 'archived'>
    >
  ): Promise<ApiResult<Child>> {
    return apiClient.patch<Child>(`/user/children/${id}`, updates)
  },

  /**
   * Archive a child (soft delete)
   */
  async archive(id: string): Promise<ApiResult<Child>> {
    return apiClient.patch<Child>(`/user/children/${id}/archive`, {})
  },

  /**
   * Delete a child (permanent)
   */
  async delete(id: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/children/${id}`)
  },
}
