/**
 * KB Articles Service for WC Superadmin
 *
 * Service layer for all KB articles-related API calls
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  AddRelatedArticleData,
  Article,
  CheckSlugAvailabilityResult,
  CreateArticleData,
  FeedbackStatusResult,
  QueryArticlesParams,
  RelatedArticle,
  ReorderRelatedArticlesData,
  SubmitFeedbackData,
  UpdateArticleData,
} from '@world-schools/wc-frontend-utils'

export interface ArticleStats {
  total: number
  published: number
  drafts: number
  avgHelpfulness: number
}

/**
 * Get all KB articles with pagination and filtering (Admin)
 */
export async function getArticles(params?: QueryArticlesParams): Promise<ApiResult<Article[]>> {
  const queryParams = new URLSearchParams()

  if (params?.status) queryParams.append('status', params.status)
  if (params?.audience) {
    params.audience.forEach(aud => queryParams.append('audience', aud))
  }
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId)
  if (params?.articleType) queryParams.append('articleType', params.articleType)
  if (params?.search) queryParams.append('search', params.search)
  if (params?.searchBy) queryParams.append('searchBy', params.searchBy)
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())

  const url = queryParams.toString()
    ? `/superadmin/kb/articles?${queryParams.toString()}`
    : '/superadmin/kb/articles'

  return await apiClient.get<Article[]>(url)
}

/**
 * Get global KB article stats (Admin)
 */
export async function getArticleStats(): Promise<ApiResult<ArticleStats>> {
  return await apiClient.get<ArticleStats>('/superadmin/kb/articles/stats')
}

/**
 * Get a single KB article by ID (Admin)
 */
export async function getArticle(id: string): Promise<ApiResult<Article>> {
  return await apiClient.get<Article>(`/superadmin/kb/articles/${id}`)
}

/**
 * Create a new KB article (Admin)
 */
export async function createArticle(articleData: CreateArticleData): Promise<ApiResult<Article>> {
  return await apiClient.post<Article>('/superadmin/kb/articles', articleData)
}

/**
 * Update an existing KB article (Admin)
 */
export async function updateArticle(
  id: string,
  articleData: UpdateArticleData
): Promise<ApiResult<Article>> {
  return await apiClient.patch<Article>(`/superadmin/kb/articles/${id}`, articleData)
}

/**
 * Delete a KB article (Admin)
 */
export async function deleteArticle(id: string): Promise<ApiResult<{ message: string }>> {
  return await apiClient.del<{ message: string }>(`/superadmin/kb/articles/${id}`)
}

/**
 * Publish a KB article (Admin)
 */
export async function publishArticle(id: string): Promise<ApiResult<Article>> {
  return await apiClient.post<Article>(`/superadmin/kb/articles/${id}/publish`, {})
}

/**
 * Unpublish a KB article (Admin)
 */
export async function unpublishArticle(id: string): Promise<ApiResult<Article>> {
  return await apiClient.post<Article>(`/superadmin/kb/articles/${id}/unpublish`, {})
}

/**
 * Duplicate a KB article (Admin)
 */
export async function duplicateArticle(id: string): Promise<ApiResult<Article>> {
  return await apiClient.post<Article>(`/superadmin/kb/articles/${id}/duplicate`, {})
}

/**
 * Check if a slug is available (Admin)
 */
export async function checkArticleSlugAvailability(
  slug: string,
  articleId?: string
): Promise<ApiResult<CheckSlugAvailabilityResult>> {
  const queryParams = new URLSearchParams()
  if (articleId) queryParams.append('articleId', articleId)

  const url = queryParams.toString()
    ? `/superadmin/kb/articles/check-slug/${slug}?${queryParams.toString()}`
    : `/superadmin/kb/articles/check-slug/${slug}`

  return await apiClient.get<CheckSlugAvailabilityResult>(url)
}

/**
 * Get related articles for an article (Admin)
 */
export async function getRelatedArticles(id: string): Promise<ApiResult<RelatedArticle[]>> {
  return await apiClient.get<RelatedArticle[]>(`/superadmin/kb/articles/${id}/related`)
}

/**
 * Add a related article (Admin)
 */
export async function addRelatedArticle(
  id: string,
  relatedData: AddRelatedArticleData
): Promise<ApiResult<any>> {
  return await apiClient.post<any>(`/superadmin/kb/articles/${id}/related`, relatedData)
}

/**
 * Remove a related article (Admin)
 */
export async function removeRelatedArticle(
  id: string,
  relatedId: string
): Promise<ApiResult<{ message: string }>> {
  return await apiClient.del<{ message: string }>(
    `/superadmin/kb/articles/${id}/related/${relatedId}`
  )
}

/**
 * Reorder related articles (Admin)
 */
export async function reorderRelatedArticles(
  id: string,
  reorderData: ReorderRelatedArticlesData
): Promise<ApiResult<{ success: boolean; message: string }>> {
  return await apiClient.patch<{ success: boolean; message: string }>(
    `/superadmin/kb/articles/${id}/related/reorder`,
    reorderData
  )
}

// ============================================
// Public Endpoints
// ============================================

/**
 * Get all published KB articles (Public)
 */
export async function getPublicArticles(
  params?: QueryArticlesParams
): Promise<ApiResult<Article[]>> {
  const queryParams = new URLSearchParams()

  if (params?.audience) {
    params.audience.forEach(aud => queryParams.append('audience', aud))
  }
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId)
  if (params?.articleType) queryParams.append('articleType', params.articleType)
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())

  const url = queryParams.toString() ? `/kb/articles?${queryParams.toString()}` : '/kb/articles'

  return await apiClient.get<Article[]>(url)
}

/**
 * Get a published KB article by slug (Public)
 */
export async function getPublicArticleBySlug(slug: string): Promise<ApiResult<Article>> {
  return await apiClient.get<Article>(`/kb/articles/${slug}`)
}

/**
 * Get related articles for a published article (Public)
 */
export async function getPublicRelatedArticles(slug: string): Promise<ApiResult<RelatedArticle[]>> {
  return await apiClient.get<RelatedArticle[]>(`/kb/articles/${slug}/related`)
}

/**
 * Submit helpful/not helpful feedback (Public)
 */
export async function submitArticleFeedback(
  id: string,
  feedbackData: SubmitFeedbackData
): Promise<ApiResult<{ success: boolean; message: string }>> {
  return await apiClient.post<{ success: boolean; message: string }>(
    `/kb/articles/${id}/helpful`,
    feedbackData
  )
}

/**
 * Check if user has already voted on an article (Public)
 */
export async function checkFeedbackStatus(
  id: string,
  sessionId?: string
): Promise<ApiResult<FeedbackStatusResult>> {
  const queryParams = new URLSearchParams()
  if (sessionId) queryParams.append('sessionId', sessionId)

  const url = queryParams.toString()
    ? `/kb/articles/${id}/feedback-status?${queryParams.toString()}`
    : `/kb/articles/${id}/feedback-status`

  return await apiClient.get<FeedbackStatusResult>(url)
}
