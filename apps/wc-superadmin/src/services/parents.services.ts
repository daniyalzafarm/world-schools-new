import apiClient from '../utils/api-client'
import type { GetParentsResponse, ParentFilters, ParentStats } from '../types/parents'

const PARENTS_ENDPOINT = '/superadmin/parents'

export const parentsService = {
  async getParents(
    query: {
      page?: number
      limit?: number
    } & ParentFilters
  ): Promise<GetParentsResponse> {
    const params = new URLSearchParams()
    params.append('page', String(query.page ?? 1))
    params.append('limit', String(query.limit ?? 20))
    if (query.search) params.append('search', query.search)
    if (query.tab && query.tab !== 'all') params.append('tab', query.tab)
    if (query.country) params.append('country', query.country)
    const response = await apiClient.get<GetParentsResponse>(
      `${PARENTS_ENDPOINT}?${params.toString()}`
    )
    return response.data as GetParentsResponse
  },

  async getStats(): Promise<ParentStats> {
    const response = await apiClient.get<ParentStats>(`${PARENTS_ENDPOINT}/stats`)
    return response.data as ParentStats
  },
}
