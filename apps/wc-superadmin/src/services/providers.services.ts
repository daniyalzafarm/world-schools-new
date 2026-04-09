import apiClient from '../utils/api-client'
import type { ProviderDetail } from '../types/providers'

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
}
