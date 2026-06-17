import type { User } from '@/types/auth'

/**
 * Check if user is a provider admin with full access to the provider's data — either the provider
 * owner (system 'Provider Admin' role) or a per-provider full-access "Admin" role
 * (provider-scoped system role). Mirrors the backend `ProviderAccessGuard` 'admin' tier.
 */
export function isProviderAdmin(user: User | null): boolean {
  if (!user) return false
  return (
    user.roles?.some(
      role =>
        role.name === 'Provider Admin' || (role.providerId != null && role.isSystemRole === true)
    ) ?? false
  )
}

/**
 * Check if user has a provider-specific role (providerId is not null)
 * This includes custom provider roles but NOT system roles like Provider Admin
 */
export function hasProviderRole(user: User | null): boolean {
  if (!user) return false
  // Check if user has at least one role with a providerId
  return (
    user.roles?.some(role => role.providerId !== null && role.providerId !== undefined) ?? false
  )
}

/**
 * Check if user is authorized to access the provider app
 * User must have Provider Admin role OR provider-specific roles
 * This matches the backend logic in provider/auth/auth.controller.ts
 */
export function isAuthorizedProviderUser(user: User | null): boolean {
  if (!user) return false
  // Accept users with Provider Admin role OR provider-specific roles
  // This matches backend: role.name === 'Provider Admin' || role.provider_id !== null
  return isProviderAdmin(user) || hasProviderRole(user)
}
