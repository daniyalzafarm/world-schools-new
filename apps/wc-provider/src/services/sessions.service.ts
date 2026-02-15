import apiClient from '@/utils/api-client'
import type {
  CreateSessionDto,
  DeleteSessionResponse,
  SessionResponse,
  SessionsResponse,
  UpdateSessionDto,
} from '@/types/sessions'

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
