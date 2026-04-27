import type { ApiResult } from '@world-schools/wc-utils'

/**
 * Pulls a user-displayable message out of an `ApiResult` (the discriminated
 * union returned by every method on `apiClient`). Centralizing this avoids
 * the brittle inline `(result.data as { message?: string })?.message` cast
 * pattern that was duplicated across every Stripe handler.
 *
 * - On success: returns null (caller already has the data).
 * - On error with a structured `data.message`: returns that.
 * - On error without one (rare — usually a transport-layer failure): returns
 *   the supplied `fallback`.
 */
export function extractApiErrorMessage<T>(result: ApiResult<T>, fallback: string): string | null {
  if (result.success) return null
  return result.data?.message ?? fallback
}
