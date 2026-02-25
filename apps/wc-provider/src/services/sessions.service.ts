import apiClient from '@/utils/api-client'
import type {
  CreateSessionDto,
  DeleteSessionResponse,
  SessionResponse,
  SessionsResponse,
  UpdateSessionDto,
} from '@/types/sessions'
import type {
  AddSessionDiscountDto,
  ApplyGlobalDiscountDto,
  RemoveGlobalDiscountDto,
} from '@/types/discounts'

const BASE_PATH = '/provider/camps'

/**
 * Get all sessions for a camp
 */
export async function getAllSessions(campId: string, sortBy?: string): Promise<SessionsResponse> {
  const url = sortBy
    ? `${BASE_PATH}/${campId}/sessions?sortBy=${sortBy}`
    : `${BASE_PATH}/${campId}/sessions`
  const response = await apiClient.get<SessionsResponse>(url)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionsResponse
}

/**
 * Create a session
 */
export async function createSession(
  campId: string,
  data: CreateSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(`${BASE_PATH}/${campId}/sessions`, data)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Update a session
 */
export async function updateSession(
  campId: string,
  sessionId: string,
  data: UpdateSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.put<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Delete a session
 */
export async function deleteSession(
  campId: string,
  sessionId: string
): Promise<DeleteSessionResponse> {
  const response = await apiClient.del<DeleteSessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as DeleteSessionResponse
}

/**
 * Toggle session status (draft/published)
 */
export async function toggleSessionStatus(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.patch<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/toggle`,
    {}
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Duplicate a session
 */
export async function duplicateSession(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/duplicate`,
    {}
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Add a session-specific discount
 */
export async function addSessionDiscount(
  campId: string,
  sessionId: string,
  data: AddSessionDiscountDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/discounts`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Remove a session-specific discount
 */
export async function removeSessionDiscount(
  campId: string,
  sessionId: string,
  discountId: string
): Promise<SessionResponse> {
  const response = await apiClient.del<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/discounts/${discountId}`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Remove a global discount from a session
 */
export async function removeGlobalDiscountFromSession(
  campId: string,
  sessionId: string,
  data: RemoveGlobalDiscountDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/discounts/remove-global`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Apply a global discount to a session
 */
export async function applyGlobalDiscountToSession(
  campId: string,
  sessionId: string,
  data: ApplyGlobalDiscountDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/discounts/apply-global`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}
