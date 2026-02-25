/**
 * Security Services for WC Provider (Provider Portal)
 *
 * This service handles all security-related API calls for the provider portal.
 * Calls the /provider/auth/* endpoints.
 */

import apiClient from '@/utils/api-client'
import type { ApiResult, Session, TwoFactorStatus } from '@world-schools/wc-types'

/**
 * Get 2FA status
 */
export async function getTwoFactorStatus(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.get('provider/auth/two-factor/status')
}

/**
 * Enable Email 2FA
 */
export async function enableTwoFactor(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.post('provider/auth/two-factor/enable', {})
}

/**
 * Disable Email 2FA
 */
export async function disableTwoFactor(): Promise<ApiResult<TwoFactorStatus>> {
  return apiClient.post('provider/auth/two-factor/disable', {})
}

/**
 * Get all active sessions
 */
export async function getSessions(): Promise<ApiResult<{ sessions: Session[] }>> {
  return apiClient.get('provider/auth/sessions')
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string): Promise<ApiResult<{ message: string }>> {
  return apiClient.del(`provider/auth/sessions/${sessionId}`)
}

/**
 * Revoke all other sessions
 */
export async function revokeAllOtherSessions(): Promise<
  ApiResult<{ message: string; revokedCount: number }>
> {
  return apiClient.post('provider/auth/sessions/revoke-all-others', {})
}
