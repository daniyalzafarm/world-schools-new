import apiClient from '../utils/api-client'
import type { ProviderDetail } from '../types/providers'

export interface UpdateAppFeePayload {
  custom: boolean
  appFeePercentage?: number
}

export interface ImportRowError {
  column: number
  email: string
  reason: string
}

export interface ImportProvidersResult {
  imported: number
  failed: number
  errors: ImportRowError[]
}

export interface ImportCampRowError {
  column: number
  name: string
  reason: string
}

export interface ImportCampsResult {
  imported: number
  failed: number
  errors: ImportCampRowError[]
}

export interface ImportSessionRowError {
  column: number
  name: string
  reason: string
}

export interface ImportSessionsResult {
  imported: number
  failed: number
  errors: ImportSessionRowError[]
}

export const providersService = {
  async getList(): Promise<{ id: string; legalCompanyName: string }[]> {
    const response =
      await apiClient.get<{ id: string; legalCompanyName: string }[]>('/superadmin/providers')
    return (response.data as { id: string; legalCompanyName: string }[]) ?? []
  },

  async getDetail(id: string): Promise<ProviderDetail> {
    const response = await apiClient.get<ProviderDetail>(`/superadmin/providers/${id}/detail`)
    return response.data as ProviderDetail
  },

  async impersonateProvider(id: string): Promise<{ token: string }> {
    const response = await apiClient.post<{ token: string }>(
      `/superadmin/providers/${id}/impersonate`,
      {}
    )
    return response.data as { token: string }
  },

  async setAppFee(id: string, payload: UpdateAppFeePayload): Promise<ProviderDetail> {
    const response = await apiClient.patch<ProviderDetail>(
      `/superadmin/providers/${id}/app-fee`,
      payload
    )
    return response.data as ProviderDetail
  },

  async importProviders(file: File): Promise<ImportProvidersResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ImportProvidersResult>(
      '/superadmin/providers/import',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data as ImportProvidersResult
  },

  async importSessions(
    providerId: string,
    campId: string,
    file: File
  ): Promise<ImportSessionsResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ImportSessionsResult>(
      `/superadmin/providers/${providerId}/camps/${campId}/sessions/import`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data as ImportSessionsResult
  },

  async importCamps(providerId: string, file: File): Promise<ImportCampsResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ImportCampsResult>(
      `/superadmin/providers/${providerId}/camps/import`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data as ImportCampsResult
  },
}
