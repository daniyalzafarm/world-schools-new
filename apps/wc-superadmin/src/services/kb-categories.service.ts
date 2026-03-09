/**
 * KB Categories Service for WC Superadmin
 *
 * Service layer for all KB categories-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  ArticleCategory,
  CheckSlugAvailabilityResult,
  CreateCategoryData,
  PublicArticleCategory,
  QueryCategoriesParams,
  ReorderCategoryData,
  UpdateCategoryData,
} from '@world-schools/wc-frontend-utils'

/**
 * Get all KB categories with pagination and filtering (Admin)
 */
export async function getCategories(
  params?: QueryCategoriesParams
): Promise<ApiResult<ArticleCategory[]>> {
  const queryParams = new URLSearchParams()

  if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())

  const url = queryParams.toString()
    ? `/superadmin/kb/categories?${queryParams.toString()}`
    : '/superadmin/kb/categories'

  return await apiClient.get<ArticleCategory[]>(url)
}

/**
 * Get a single KB category by ID (Admin)
 */
export async function getCategory(id: string): Promise<ApiResult<ArticleCategory>> {
  return await apiClient.get<ArticleCategory>(`/superadmin/kb/categories/${id}`)
}

/**
 * Create a new KB category (Admin)
 */
export async function createCategory(
  categoryData: CreateCategoryData
): Promise<ApiResult<ArticleCategory>> {
  return await apiClient.post<ArticleCategory>('/superadmin/kb/categories', categoryData)
}

/**
 * Update an existing KB category (Admin)
 */
export async function updateCategory(
  id: string,
  categoryData: UpdateCategoryData
): Promise<ApiResult<ArticleCategory>> {
  return await apiClient.patch<ArticleCategory>(`/superadmin/kb/categories/${id}`, categoryData)
}

/**
 * Delete a KB category (Admin)
 * Note: Can only delete if category has no articles
 */
export async function deleteCategory(id: string): Promise<ApiResult<{ message: string }>> {
  return await apiClient.del<{ message: string }>(`/superadmin/kb/categories/${id}`)
}

/**
 * Update category sort order (Admin)
 */
export async function reorderCategory(
  id: string,
  reorderData: ReorderCategoryData
): Promise<ApiResult<ArticleCategory>> {
  return await apiClient.patch<ArticleCategory>(
    `/superadmin/kb/categories/${id}/reorder`,
    reorderData
  )
}

/**
 * Check if a slug is available (Admin)
 */
export async function checkSlugAvailability(
  slug: string,
  categoryId?: string
): Promise<ApiResult<CheckSlugAvailabilityResult>> {
  const queryParams = new URLSearchParams()
  if (categoryId) queryParams.append('categoryId', categoryId)

  const url = queryParams.toString()
    ? `/superadmin/kb/categories/check-slug/${slug}?${queryParams.toString()}`
    : `/superadmin/kb/categories/check-slug/${slug}`

  return await apiClient.get<CheckSlugAvailabilityResult>(url)
}

/**
 * Get all active KB categories (Public)
 * Returns categories with article counts for public display
 */
export async function getPublicCategories(): Promise<ApiResult<PublicArticleCategory[]>> {
  return await apiClient.get<PublicArticleCategory[]>('/kb/categories')
}
