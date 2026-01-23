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
   * Create a new child
   */
  async create(child: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResult<Child>> {
    return apiClient.post<Child>('/user/children', child)
  },

  /**
   * Update an existing child
   */
  async update(
    id: string,
    updates: Partial<Omit<Child, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResult<Child>> {
    return apiClient.patch<Child>(`/user/children/${id}`, updates)
  },

  /**
   * Delete a child
   */
  async delete(id: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/children/${id}`)
  },
}
