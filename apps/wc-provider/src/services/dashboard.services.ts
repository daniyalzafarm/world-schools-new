/**
 * Provider Dashboard Service
 *
 * Single aggregated dashboard snapshot (gated by `provider_dashboard.read`). Replaces the previous
 * ~9-call fan-out the dashboard page used to make.
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type { ProviderDashboardSnapshot } from '@/types/provider-dashboard'

/** Server-provided dashboard snapshot — the client supplies `user` and `unreadMessages` itself. */
export type DashboardSnapshotResponse = Omit<
  ProviderDashboardSnapshot,
  'user' | 'unreadMessages' | 'now'
>

export async function getDashboard(): Promise<ApiResult<DashboardSnapshotResponse>> {
  return await apiClient.get<DashboardSnapshotResponse>('/provider/dashboard')
}
