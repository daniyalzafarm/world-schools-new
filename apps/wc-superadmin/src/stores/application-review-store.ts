import { create } from 'zustand'
import type {
  ApplicationDetail,
  ApplicationListItem,
  ApproveApplicationRequest,
  GetApplicationsQuery,
  RejectApplicationRequest,
  RequestInfoRequest,
  ReviewDocumentRequest,
  VerificationDocument,
} from '../types/application-review'
import { applicationReviewService } from '../services/application-review.services'

interface ApplicationReviewStore {
  // State
  applications: ApplicationListItem[]
  selectedApplication: ApplicationDetail | null
  pendingDocuments: VerificationDocument[]
  total: number
  page: number
  limit: number
  totalPages: number
  isLoading: boolean
  error: string | null

  // Actions
  fetchApplications: (query: GetApplicationsQuery) => Promise<void>
  fetchApplicationDetail: (providerId: string) => Promise<void>
  approveApplication: (providerId: string, data: ApproveApplicationRequest) => Promise<void>
  rejectApplication: (providerId: string, data: RejectApplicationRequest) => Promise<void>
  requestInfo: (providerId: string, data: RequestInfoRequest) => Promise<void>
  fetchProviderDocuments: (providerId: string) => Promise<VerificationDocument[]>
  reviewDocument: (documentId: string, data: ReviewDocumentRequest) => Promise<void>
  fetchPendingDocuments: () => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = {
  applications: [],
  selectedApplication: null,
  pendingDocuments: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  isLoading: false,
  error: null,
}

export const useApplicationReviewStore = create<ApplicationReviewStore>((set, get) => ({
  ...initialState,

  fetchApplications: async (query: GetApplicationsQuery) => {
    set({ isLoading: true, error: null })
    try {
      const response = await applicationReviewService.getApplications(query)
      set({
        applications: response.data,
        total: response.total,
        page: response.page,
        limit: response.limit,
        totalPages: response.totalPages,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        applications: [], // Reset to empty array on error
        total: 0,
        totalPages: 0,
        error: error.message || 'Failed to fetch applications',
        isLoading: false,
      })
    }
  },

  fetchApplicationDetail: async (providerId: string) => {
    set({ isLoading: true, error: null })
    try {
      const application = await applicationReviewService.getApplicationDetail(providerId)
      set({ selectedApplication: application, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch application detail', isLoading: false })
    }
  },

  approveApplication: async (providerId: string, data: ApproveApplicationRequest) => {
    set({ isLoading: true, error: null })
    try {
      await applicationReviewService.approveApplication(providerId, data)
      await get().fetchApplicationDetail(providerId)
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to approve application', isLoading: false })
    }
  },

  rejectApplication: async (providerId: string, data: RejectApplicationRequest) => {
    set({ isLoading: true, error: null })
    try {
      await applicationReviewService.rejectApplication(providerId, data)
      await get().fetchApplicationDetail(providerId)
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to reject application', isLoading: false })
    }
  },

  requestInfo: async (providerId: string, data: RequestInfoRequest) => {
    set({ isLoading: true, error: null })
    try {
      await applicationReviewService.requestInfo(providerId, data)
      await get().fetchApplicationDetail(providerId)
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to request information', isLoading: false })
    }
  },

  fetchProviderDocuments: async (providerId: string) => {
    set({ isLoading: true, error: null })
    try {
      const documents = await applicationReviewService.getProviderDocuments(providerId)
      set({ isLoading: false })
      return documents
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch documents', isLoading: false })
      return []
    }
  },

  reviewDocument: async (documentId: string, data: ReviewDocumentRequest) => {
    set({ isLoading: true, error: null })
    try {
      await applicationReviewService.reviewDocument(documentId, data)
      // Refresh application detail if one is selected
      if (get().selectedApplication) {
        await get().fetchApplicationDetail(get().selectedApplication!.id)
      }
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to review document', isLoading: false })
    }
  },

  fetchPendingDocuments: async () => {
    set({ isLoading: true, error: null })
    try {
      const documents = await applicationReviewService.getPendingDocuments()
      set({ pendingDocuments: documents, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch pending documents', isLoading: false })
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))
