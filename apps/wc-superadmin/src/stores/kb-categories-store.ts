/**
 * KB Categories Store for WC Superadmin
 *
 * Zustand store for managing KB categories state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type {
  ArticleCategory,
  CreateCategoryData,
  QueryCategoriesParams,
  UpdateCategoryData,
} from '@world-schools/wc-frontend-utils'
import * as kbCategoriesService from '@/services/kb-categories.service'

export interface KbCategoriesState {
  categories: ArticleCategory[]
  currentCategory: ArticleCategory | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: QueryCategoriesParams
  isModalOpen: boolean
  modalMode: 'create' | 'edit'
}

export interface KbCategoriesStore extends KbCategoriesState {
  fetchCategories: () => Promise<boolean>
  getCategoryById: (id: string) => Promise<boolean>
  createCategory: (categoryData: CreateCategoryData) => Promise<boolean>
  updateCategory: (id: string, categoryData: UpdateCategoryData) => Promise<boolean>
  deleteCategory: (id: string) => Promise<boolean>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<QueryCategoriesParams>) => void
  clearFilters: () => void
  clearError: () => void
  setCurrentCategory: (category: ArticleCategory | null) => void
  openModal: (mode: 'create' | 'edit', category?: ArticleCategory) => void
  closeModal: () => void
}

// Initial state
const initialState: KbCategoriesState = {
  categories: [],
  currentCategory: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},
  isModalOpen: false,
  modalMode: 'create',
}

export const useKbCategoriesStore = create<KbCategoriesStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchCategories: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Get current state values (not draft proxies)
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        const response = await kbCategoriesService.getCategories({
          page: currentPage,
          limit: currentLimit,
          ...currentFilters,
        })

        if (response.success && response.data) {
          const meta = response.meta as
            | { page: number; limit: number; total: number; totalPages: number }
            | undefined

          set(draft => {
            draft.categories = response.data
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
              : 'Failed to fetch categories'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      getCategoryById: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbCategoriesService.getCategory(id)

        if (response.success && response.data) {
          set(draft => {
            draft.currentCategory = response.data
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
              : 'Failed to fetch category'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      createCategory: async (categoryData: CreateCategoryData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbCategoriesService.createCategory(categoryData)

        if (response.success && response.data) {
          set(draft => {
            draft.categories.unshift(response.data)
            draft.pagination.total += 1
            draft.isLoading = false
            draft.isModalOpen = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to create category'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      updateCategory: async (id: string, categoryData: UpdateCategoryData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbCategoriesService.updateCategory(id, categoryData)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.categories.findIndex(c => c.id === id)
            if (index !== -1) {
              draft.categories[index] = response.data
            }
            draft.isLoading = false
            draft.isModalOpen = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to update category'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      deleteCategory: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await kbCategoriesService.deleteCategory(id)

        if (response.success) {
          set(draft => {
            draft.categories = draft.categories.filter(c => c.id !== id)
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
              : 'Failed to delete category'

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

      setCurrentCategory: category => {
        set(draft => {
          draft.currentCategory = category
        })
      },

      openModal: (mode, category) => {
        set(draft => {
          draft.modalMode = mode
          draft.currentCategory = category ?? null
          draft.isModalOpen = true
          draft.error = null
        })
      },

      closeModal: () => {
        set(draft => {
          draft.isModalOpen = false
          draft.currentCategory = null
          draft.error = null
        })
      },
    })),
    { name: 'KbCategoriesStore' }
  )
)
