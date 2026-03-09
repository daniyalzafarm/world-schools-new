/**
 * KB Articles Store for WC Superadmin
 *
 * Zustand store for managing KB articles state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type {
  Article,
  CreateArticleData,
  QueryArticlesParams,
  UpdateArticleData,
} from '@world-schools/wc-frontend-utils'
import * as kbArticlesService from '@/services/kb-articles.service'

export interface KbArticlesState {
  articles: Article[]
  currentArticle: Article | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: QueryArticlesParams
}

export interface KbArticlesStore extends KbArticlesState {
  fetchArticles: () => Promise<boolean>
  getArticleById: (id: string) => Promise<boolean>
  createArticle: (articleData: CreateArticleData) => Promise<boolean>
  updateArticle: (id: string, articleData: UpdateArticleData) => Promise<boolean>
  deleteArticle: (id: string) => Promise<boolean>
  publishArticle: (id: string) => Promise<boolean>
  unpublishArticle: (id: string) => Promise<boolean>
  duplicateArticle: (id: string) => Promise<boolean>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<QueryArticlesParams>) => void
  clearFilters: () => void
  clearError: () => void
  setCurrentArticle: (article: Article | null) => void
}

// Initial state
const initialState: KbArticlesState = {
  articles: [],
  currentArticle: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},
}

export const useKbArticlesStore = create<KbArticlesStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchArticles: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Get current state values (not draft proxies)
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        const response = await kbArticlesService.getArticles({
          page: currentPage,
          limit: currentLimit,
          ...currentFilters,
        })

        if (response.success && response.data) {
          const meta = response.meta as
            | { page: number; limit: number; total: number; totalPages: number }
            | undefined

          set(draft => {
            draft.articles = response.data
            if (meta) {
              draft.pagination = {
                page: meta.page,
                limit: meta.limit,
                total: meta.total,
                totalPages: meta.totalPages,
              }
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to fetch articles'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      getArticleById: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.getArticle(id)

        if (response.success && response.data) {
          set(draft => {
            draft.currentArticle = response.data
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to fetch article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      createArticle: async (articleData: CreateArticleData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.createArticle(articleData)

        if (response.success && response.data) {
          set(draft => {
            draft.articles.unshift(response.data)
            draft.pagination.total += 1
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to create article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      updateArticle: async (id: string, articleData: UpdateArticleData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.updateArticle(id, articleData)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.articles.findIndex(a => a.id === id)
            if (index !== -1) {
              draft.articles[index] = response.data
            }
            if (draft.currentArticle?.id === id) {
              draft.currentArticle = response.data
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to update article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      deleteArticle: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.deleteArticle(id)

        if (response.success) {
          set(draft => {
            draft.articles = draft.articles.filter(a => a.id !== id)
            draft.pagination.total -= 1
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to delete article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      publishArticle: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.publishArticle(id)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.articles.findIndex(a => a.id === id)
            if (index !== -1) {
              draft.articles[index] = response.data
            }
            if (draft.currentArticle?.id === id) {
              draft.currentArticle = response.data
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to publish article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      unpublishArticle: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.unpublishArticle(id)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.articles.findIndex(a => a.id === id)
            if (index !== -1) {
              draft.articles[index] = response.data
            }
            if (draft.currentArticle?.id === id) {
              draft.currentArticle = response.data
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to unpublish article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      duplicateArticle: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbArticlesService.duplicateArticle(id)

        if (response.success && response.data) {
          set(draft => {
            draft.articles.unshift(response.data)
            draft.pagination.total += 1
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to duplicate article'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      setPage: (page: number) => {
        set(draft => {
          draft.pagination.page = page
        })
      },

      setLimit: (limit: number) => {
        set(draft => {
          draft.pagination.limit = limit
          draft.pagination.page = 1 // Reset to first page when changing limit
        })
      },

      setFilters: filters => {
        set(draft => {
          draft.filters = { ...draft.filters, ...filters }
          draft.pagination.page = 1 // Reset to first page when filtering
        })
      },

      clearFilters: () => {
        set(draft => {
          draft.filters = {}
          draft.pagination.page = 1
        })
      },

      clearError: () => {
        set(draft => {
          draft.error = null
        })
      },

      setCurrentArticle: article => {
        set(draft => {
          draft.currentArticle = article
        })
      },
    })),
    { name: 'KbArticlesStore' }
  )
)
