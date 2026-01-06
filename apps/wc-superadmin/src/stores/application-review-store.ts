import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import { addToast } from '@heroui/react'
import type {
  ApplicationDetail,
  ApplicationListItem,
  ApprovalStatus,
  ApproveApplicationRequest,
  GetApplicationsQuery,
  RejectApplicationRequest,
  RequestInfoRequest,
  ReviewDocumentRequest,
  VerificationDocument,
} from '../types/application-review'
import { applicationReviewService } from '../services/application-review.services'

export interface ApplicationFilters {
  search?: string
  status?: ApprovalStatus
  minTrustScore?: number
  maxTrustScore?: number
}

interface ApplicationReviewState {
  // State
  applications: ApplicationListItem[]
  selectedApplication: ApplicationDetail | null
  pendingDocuments: VerificationDocument[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: ApplicationFilters
  underReviewCount: number
  isLoading: boolean
  error: string | null
}

interface ApplicationReviewStore extends ApplicationReviewState {
  // Actions
  fetchApplications: () => Promise<void>
  fetchApplicationDetail: (providerId: string) => Promise<void>
  approveApplication: (providerId: string, data: ApproveApplicationRequest) => Promise<void>
  rejectApplication: (providerId: string, data: RejectApplicationRequest) => Promise<void>
  requestInfo: (providerId: string, data: RequestInfoRequest) => Promise<void>
  fetchProviderDocuments: (providerId: string) => Promise<VerificationDocument[]>
  reviewDocument: (documentId: string, data: ReviewDocumentRequest) => Promise<void>
  fetchPendingDocuments: () => Promise<void>
  fetchUnderReviewCount: () => Promise<void>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<ApplicationFilters>) => void
  clearFilters: () => void
  clearError: () => void
  reset: () => void
}

const initialState: ApplicationReviewState = {
  applications: [],
  selectedApplication: null,
  pendingDocuments: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},
  underReviewCount: 0,
  isLoading: false,
  error: null,
}

export const useApplicationReviewStore = create<ApplicationReviewStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchApplications: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Get current state values (not draft proxies)
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        try {
          const query: GetApplicationsQuery = {
            page: currentPage,
            limit: currentLimit,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            ...currentFilters,
          }

          const response = await applicationReviewService.getApplications(query)

          set(draft => {
            draft.applications = response.data
            draft.pagination = {
              page: response.page,
              limit: response.limit,
              total: response.total,
              totalPages: response.totalPages,
            }
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.applications = []
            draft.pagination.total = 0
            draft.pagination.totalPages = 0
            draft.error = error.message || 'Failed to fetch applications'
            draft.isLoading = false
          })
        }
      },

      fetchApplicationDetail: async (providerId: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const application = await applicationReviewService.getApplicationDetail(providerId)
          set(draft => {
            draft.selectedApplication = application
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to fetch application detail'
            draft.isLoading = false
          })
        }
      },

      approveApplication: async (providerId: string, data: ApproveApplicationRequest) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          await applicationReviewService.approveApplication(providerId, data)
          await get().fetchApplicationDetail(providerId)
          // Refresh badge count after status change
          await get().fetchUnderReviewCount()
          set(draft => {
            draft.isLoading = false
          })
        } catch (error: any) {
          const errorMessage = error.message || 'Failed to approve application'
          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          // Show toast notification for backend errors
          addToast({
            title: 'Error',
            description: errorMessage,
            color: 'danger',
            timeout: 5000,
          })
        }
      },

      rejectApplication: async (providerId: string, data: RejectApplicationRequest) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          await applicationReviewService.rejectApplication(providerId, data)
          await get().fetchApplicationDetail(providerId)
          // Refresh badge count after status change
          await get().fetchUnderReviewCount()
          set(draft => {
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to reject application'
            draft.isLoading = false
          })
        }
      },

      requestInfo: async (providerId: string, data: RequestInfoRequest) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          await applicationReviewService.requestInfo(providerId, data)
          await get().fetchApplicationDetail(providerId)
          // Refresh badge count after status change
          await get().fetchUnderReviewCount()
          set(draft => {
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to request information'
            draft.isLoading = false
          })
        }
      },

      fetchProviderDocuments: async (providerId: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const documents = await applicationReviewService.getProviderDocuments(providerId)
          set(draft => {
            draft.isLoading = false
          })
          return documents
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to fetch documents'
            draft.isLoading = false
          })
          return []
        }
      },

      reviewDocument: async (documentId: string, data: ReviewDocumentRequest) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          await applicationReviewService.reviewDocument(documentId, data)
          // Refresh application detail if one is selected
          const currentState = get()
          if (currentState.selectedApplication) {
            await get().fetchApplicationDetail(currentState.selectedApplication.id)
          }
          set(draft => {
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to review document'
            draft.isLoading = false
          })
        }
      },

      fetchPendingDocuments: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const documents = await applicationReviewService.getPendingDocuments()
          set(draft => {
            draft.pendingDocuments = documents
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to fetch pending documents'
            draft.isLoading = false
          })
        }
      },

      fetchUnderReviewCount: async () => {
        try {
          // Fetch applications with under_review status without pagination limit
          const response = await applicationReviewService.getApplications({
            status: 'under_review',
            page: 1,
            limit: 1, // We only need the total count, not the data
            sortBy: 'createdAt',
            sortOrder: 'desc',
          })

          set(draft => {
            draft.underReviewCount = response.total
          })
        } catch (error: any) {
          // Silently fail - don't update error state for badge count
          console.error('Failed to fetch under review count:', error)
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

      reset: () => set(initialState),
    })),
    { name: 'ApplicationReviewStore' }
  )
)
