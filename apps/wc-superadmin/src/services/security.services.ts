/**
 * Security Services for WC Superadmin (Superadmin Portal)
 *
 * This service handles all security-related API calls for the superadmin portal.
 * Calls the /superadmin/auth/* endpoints.
 */

import apiClient from '@/utils/api-client'
import type { ApiResult, Session, TwoFactorStatus } from '@world-schools/wc-types'

/**
 * Get 2FA status
 */
export async function getTwoFactorStatus(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.get('superadmin/auth/two-factor/status')
}

/**
 * Enable Email 2FA
 */
export async function enableTwoFactor(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.post('superadmin/auth/two-factor/enable', {})
}

/**
 * Disable Email 2FA
 */
export async function disableTwoFactor(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.post('superadmin/auth/two-factor/disable', {})
}

/**
 * Get all active sessions
 */
export async function getSessions(): Promise<ApiResult<{ sessions: Session[] }>> {
  return apiClient.get('superadmin/auth/sessions')
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string): Promise<ApiResult<{ message: string }>> {
  return apiClient.del(`superadmin/auth/sessions/${sessionId}`)
}

/**
 * Revoke all other sessions
 */
export async function revokeAllOtherSessions(): Promise<
  ApiResult<{ message: string; revokedCount: number }>
> {
  return apiClient.post('superadmin/auth/sessions/revoke-all-others', {})
}
