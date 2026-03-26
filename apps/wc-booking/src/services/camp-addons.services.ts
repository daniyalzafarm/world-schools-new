import apiClient, { type ApiResult } from '@/utils/api-client'
import type { CampBookingAddOn } from '@/types/camp-booking'

export const campAddOnsService = {
  async getByCampId(campId: string): Promise<ApiResult<CampBookingAddOn[]>> {
    return apiClient.get<CampBookingAddOn[]>(`/user/camps/${campId}/addons`)
  },
}
