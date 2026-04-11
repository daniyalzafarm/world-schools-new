import apiClient from '../utils/api-client'
import type { ProviderDetail } from '../types/providers'

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

export const providersService = {
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
}
