import { SetMetadata } from '@nestjs/common'

/**
 * Provider access levels for `ProviderAccessGuard`.
 * - `admin`  — the provider owner or the per-provider full-access "Admin" role.
 * - `member` — any provider user (owner or any provider-scoped role), used for read endpoints that
 *              every member needs (e.g. the provider's name/logo for the sidebar).
 */
export type ProviderAccessLevel = 'admin' | 'member'

export const PROVIDER_ACCESS_KEY = 'providerAccess'

export const ProviderAccess = (level: ProviderAccessLevel) =>
  SetMetadata(PROVIDER_ACCESS_KEY, level)
