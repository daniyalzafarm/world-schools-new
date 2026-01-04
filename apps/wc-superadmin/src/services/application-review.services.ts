import apiClient from '../utils/api-client'
import type {
  ApplicationDetail,
  ApproveApplicationRequest,
  GetApplicationsQuery,
  GetApplicationsResponse,
  RejectApplicationRequest,
  RequestInfoRequest,
  ReviewDocumentRequest,
  VerificationDocument,
} from '../types/application-review'

export const applicationReviewService = {
  /**
   * Get paginated list of applications
   */
  async getApplications(query: GetApplicationsQuery): Promise<GetApplicationsResponse> {
    const params = new URLSearchParams()

    // Ensure page is a valid positive integer (default to 1)
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1
    params.append('page', page.toString())

    // Ensure limit is a valid positive integer between 1 and 100 (default to 20)
    let limit = query.limit && query.limit > 0 ? Math.floor(query.limit) : 20
    limit = Math.min(limit, 100) // Cap at 100
    params.append('limit', limit.toString())

    if (query.status) params.append('status', query.status)
    if (query.search) params.append('search', query.search)
    if (query.minTrustScore !== undefined && query.minTrustScore !== null) {
      params.append('minTrustScore', query.minTrustScore.toString())
    }
    if (query.maxTrustScore !== undefined && query.maxTrustScore !== null) {
      params.append('maxTrustScore', query.maxTrustScore.toString())
    }
    if (query.sortBy) params.append('sortBy', query.sortBy)
    if (query.sortOrder) params.append('sortOrder', query.sortOrder)

    const response = await apiClient.get<GetApplicationsResponse>(
      `/superadmin/applications?${params.toString()}`
    )
    return response.data as GetApplicationsResponse
  },

  /**
   * Get detailed application information
   */
  async getApplicationDetail(providerId: string): Promise<ApplicationDetail> {
    const response = await apiClient.get<ApplicationDetail>(
      `/superadmin/applications/${providerId}`
    )
    return response.data as ApplicationDetail
  },

  /**
   * Approve an application
   */
  async approveApplication(providerId: string, data: ApproveApplicationRequest): Promise<void> {
    await apiClient.post(`/superadmin/applications/${providerId}/approve`, data)
  },

  /**
   * Reject an application
   */
  async rejectApplication(providerId: string, data: RejectApplicationRequest): Promise<void> {
    await apiClient.post(`/superadmin/applications/${providerId}/reject`, data)
  },

  /**
   * Request additional information
   */
  async requestInfo(providerId: string, data: RequestInfoRequest): Promise<void> {
    await apiClient.post(`/superadmin/applications/${providerId}/request-info`, data)
  },

  /**
   * Get provider documents
   */
  async getProviderDocuments(providerId: string): Promise<VerificationDocument[]> {
    const response = await apiClient.get<VerificationDocument[]>(
      `/superadmin/applications/${providerId}/documents`
    )
    return response.data as VerificationDocument[]
  },

  /**
   * Review a document
   */
  async reviewDocument(documentId: string, data: ReviewDocumentRequest): Promise<void> {
    await apiClient.post(`/superadmin/applications/documents/${documentId}/review`, data)
  },

  /**
   * Get pending documents
   */
  async getPendingDocuments(): Promise<VerificationDocument[]> {
    const response = await apiClient.get<VerificationDocument[]>(
      '/superadmin/applications/documents/pending/list'
    )
    return response.data as VerificationDocument[]
  },
}
