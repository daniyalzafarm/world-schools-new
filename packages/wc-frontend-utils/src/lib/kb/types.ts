/**
 * Knowledge Base Types
 *
 * Shared types for KB Categories and Articles across all frontend apps
 */

// ============================================
// Article Category Types
// ============================================

export interface ArticleCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    articles: number
  }
}

export interface CreateCategoryData {
  name: string
  slug: string
  description?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateCategoryData {
  name?: string
  slug?: string
  description?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

export interface QueryCategoriesParams {
  isActive?: boolean
  search?: string
  sortBy?: 'name' | 'sortOrder' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ReorderCategoryData {
  sortOrder: number
}

export interface CheckSlugAvailabilityResult {
  available: boolean
}

// ============================================
// Public Category Types (for public endpoints)
// ============================================

export interface PublicArticleCategory {
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

// ============================================
// Article Enums
// ============================================

export enum ArticleType {
  HOW_TO = 'how_to',
  FAQ = 'faq',
  REFERENCE = 'reference',
  POLICY = 'policy',
}

export enum Audience {
  PARENTS = 'parents',
  PROVIDERS = 'providers',
  STAFF = 'staff',
}

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// ============================================
// Article Types
// ============================================

export interface Article {
  id: string
  title: string
  slug: string
  articleType: ArticleType
  audience: Audience[]
  categoryId: string
  status: ArticleStatus
  contentHtml: string
  summary: string | null
  metaTitle: string
  metaDescription: string
  author: string
  publishedAt: string | null
  lastUpdatedAt: string | null
  views: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  updatedAt: string
  category?: ArticleCategory
  relatedFrom?: RelatedArticle[]
}

export interface RelatedArticle {
  id: string
  title: string
  slug: string
  summary: string | null
  articleType: ArticleType
  status?: ArticleStatus
  relationId?: string
  sortOrder?: number
  category?: {
    id: string
    name: string
    slug: string
    icon: string | null
  }
}

export interface CreateArticleData {
  title: string
  slug: string
  articleType: ArticleType
  audience: Audience[]
  categoryId: string
  status?: ArticleStatus
  contentHtml: string
  summary?: string
  metaTitle: string
  metaDescription: string
  relatedArticleIds?: string[]
}

export interface UpdateArticleData {
  title?: string
  slug?: string
  articleType?: ArticleType
  audience?: Audience[]
  categoryId?: string
  status?: ArticleStatus
  contentHtml?: string
  summary?: string
  metaTitle?: string
  metaDescription?: string
  relatedArticleIds?: string[]
}

export interface QueryArticlesParams {
  status?: ArticleStatus
  audience?: Audience[]
  categoryId?: string
  articleType?: ArticleType
  search?: string
  /** Comma-separated field names to search in (e.g. title, summary, contentHtml). If omitted, searches title, summary, and contentHtml. */
  searchBy?: string
  sortBy?: 'createdAt' | 'publishedAt' | 'updatedAt' | 'views' | 'title'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface SubmitFeedbackData {
  helpful: boolean
  sessionId?: string
}

export interface FeedbackStatusResult {
  hasVoted: boolean
  isHelpful?: boolean
  votedAt?: string
}

export interface AddRelatedArticleData {
  relatedArticleId: string
  sortOrder?: number
}

export interface RelatedArticleOrder {
  relatedArticleId: string
  sortOrder: number
}

export interface ReorderRelatedArticlesData {
  relatedArticles: RelatedArticleOrder[]
}
