import apiClient, { type ApiResult } from '@/utils/api-client'
import type { Session } from '@/types/sessions'

export const campSessionsService = {
  async getByCampId(campId: string): Promise<ApiResult<Session[]>> {
    return apiClient.get<Session[]>(`/user/camps/${campId}/sessions`)
  },
}
