/**
 * Public KB Help API service factory.
 * Injects an API client so the same logic works across wc-booking, wc-provider, wc-superadmin.
 * Context (user | provider | staff) is used in dynamic routes: categories and popular articles.
 */

import type { ApiResult, KbArticle, KbArticleListItem, KbCategory } from '@world-schools/wc-types'

/** URL context for KB public routes. Maps to audience: user→parents, provider→providers, staff→staff. */
export type KbHelpContext = 'user' | 'provider' | 'staff'

export interface KbHelpApiClient {
  get<T>(url: string): Promise<ApiResult<T>>
  post<T>(url: string, body?: unknown): Promise<ApiResult<T>>
}

const KB = '/kb' as const

export interface KbHelpService {
  getCategories: () => Promise<ApiResult<KbCategory[]>>
  getArticles: (params: {
    categoryId?: string
    audience?: string[]
    page?: number
    limit?: number
    search?: string
  }) => Promise<ApiResult<KbArticleListItem[]>>
  getPopularArticles: (limit?: number) => Promise<ApiResult<KbArticleListItem[]>>
  getArticleBySlug: (slug: string) => Promise<ApiResult<KbArticle>>
  getRelatedArticles: (slug: string) => Promise<ApiResult<KbArticleListItem[]>>
  submitArticleFeedback: (
    articleId: string,
    helpful: boolean,
    sessionId?: string
  ) => Promise<ApiResult<{ success: boolean; message: string }>>
  checkFeedbackStatus: (
    articleId: string,
    sessionId?: string
  ) => Promise<ApiResult<{ hasVoted: boolean; isHelpful?: boolean; votedAt?: string }>>
}

export function createKbHelpService(
  apiClient: KbHelpApiClient,
  context: KbHelpContext
): KbHelpService {
  return {
    getCategories() {
      return apiClient.get<KbCategory[]>(`${context}${KB}/categories`)
    },

    getArticles(params) {
      const searchParams = new URLSearchParams()
      if (params.categoryId) searchParams.set('categoryId', params.categoryId)
      if (params.audience?.length) searchParams.set('audience', params.audience.join(','))
      if (params.page != null) searchParams.set('page', String(params.page))
      if (params.limit != null) searchParams.set('limit', String(params.limit))
      if (params.search) searchParams.set('search', params.search)
      const q = searchParams.toString()
      const url = q ? `${KB}/articles?${q}` : `${KB}/articles`
      return apiClient.get<KbArticleListItem[]>(url)
    },

    getPopularArticles(limit = 8) {
      return apiClient.get<KbArticleListItem[]>(
        `${KB}/articles/${context}/popular?limit=${Math.min(Math.max(1, limit), 20)}`
      )
    },

    getArticleBySlug(slug: string) {
      return apiClient.get<KbArticle>(`${KB}/articles/${encodeURIComponent(slug)}`)
    },

    getRelatedArticles(slug: string) {
      return apiClient.get<KbArticleListItem[]>(
        `${KB}/articles/${encodeURIComponent(slug)}/related`
      )
    },

    submitArticleFeedback(articleId: string, helpful: boolean, sessionId?: string) {
      return apiClient.post<{ success: boolean; message: string }>(
        `${KB}/articles/${articleId}/helpful`,
        { helpful, sessionId }
      )
    },

    checkFeedbackStatus(articleId: string, sessionId?: string) {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
      return apiClient.get<{
        hasVoted: boolean
        isHelpful?: boolean
        votedAt?: string
      }>(`${KB}/articles/${articleId}/feedback-status${q}`)
    },
  }
}
