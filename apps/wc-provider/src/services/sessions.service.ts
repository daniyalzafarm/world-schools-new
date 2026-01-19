import apiClient from '@/utils/api-client'
import type {
  CreateFixedSessionDto,
  CreateFlexibleSessionDto,
  DeleteSessionResponse,
  FixedSessionsResponse,
  FlexibleSessionsResponse,
  SessionResponse,
  SessionTypeResponse,
  UpdateFixedSessionDto,
  UpdateFlexibleSessionDto,
  UpdateSessionTypeDto,
} from '@/types/sessions'

const BASE_PATH = '/provider/camps'

/**
 * Get session type for a camp
 */
export async function getSessionType(campId: string): Promise<SessionTypeResponse> {
  const response = await apiClient.get<SessionTypeResponse>(`${BASE_PATH}/${campId}/sessions/type`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionTypeResponse
}

/**
 * Set session type for a camp
 */
export async function setSessionType(
  campId: string,
  data: UpdateSessionTypeDto
): Promise<{ sessionType: string; message: string }> {
  const response = await apiClient.put<{ sessionType: string; message: string }>(
    `${BASE_PATH}/${campId}/sessions/type`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as { sessionType: string; message: string }
}

/**
 * Get all flexible sessions for a camp
 */
export async function getFlexibleSessions(campId: string): Promise<FlexibleSessionsResponse> {
  const response = await apiClient.get<FlexibleSessionsResponse>(
    `${BASE_PATH}/${campId}/sessions/flexible`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as FlexibleSessionsResponse
}

/**
 * Get all fixed sessions for a camp
 */
export async function getFixedSessions(campId: string): Promise<FixedSessionsResponse> {
  const response = await apiClient.get<FixedSessionsResponse>(
    `${BASE_PATH}/${campId}/sessions/fixed`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as FixedSessionsResponse
}

/**
 * Create a flexible session
 */
export async function createFlexibleSession(
  campId: string,
  data: CreateFlexibleSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/flexible`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Create a fixed session
 */
export async function createFixedSession(
  campId: string,
  data: CreateFixedSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/fixed`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Update a flexible session
 */
export async function updateFlexibleSession(
  campId: string,
  sessionId: string,
  data: UpdateFlexibleSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.put<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/flexible/${sessionId}`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Update a fixed session
 */
export async function updateFixedSession(
  campId: string,
  sessionId: string,
  data: UpdateFixedSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.put<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/fixed/${sessionId}`,
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
 * Toggle session active status
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
 * Duplicate a fixed session
 */
export async function duplicateFixedSession(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/fixed/${sessionId}/duplicate`,
    {}
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}
