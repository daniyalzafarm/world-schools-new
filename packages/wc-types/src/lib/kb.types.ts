/**
 * Knowledge Base Types for World Camps applications.
 *
 * These types mirror the wc-nest-api public KB responses and are shared
 * across all frontend apps (wc-booking, wc-superadmin, wc-provider).
 */

export type ArticleType = 'how_to' | 'faq' | 'reference' | 'policy'

export interface KbCategoryRef {
  id: string
  name: string
  slug: string
  icon?: string | null
}

export interface KbCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sortOrder: number
  _count: {
    articles: number
  }
}

export interface KbArticleListItem {
  id: string
  title: string
  slug: string
  summary: string | null
  articleType: ArticleType
  category: KbCategoryRef
  helpfulCount: number
  notHelpfulCount: number
}

export interface KbArticle extends KbArticleListItem {
  contentHtml: string
  metaTitle: string
  metaDescription: string
  publishedAt: string | null
  lastUpdatedAt: string | null
  views: number
  category: KbCategoryRef
  relatedFrom?: Array<{
    relatedArticle: Pick<KbArticleListItem, 'id' | 'title' | 'slug' | 'summary' | 'articleType'>
  }>
}

export interface KbArticlesResponse {
  data: KbArticleListItem[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}
