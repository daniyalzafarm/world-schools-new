/**
 * Protected Route Component for WC Provider
 *
 * This component uses the shared ProtectedRoute from @world-schools/wc-frontend-utils
 * configured with the provider auth store and role checking.
 *
 * Security Note: Unauthorized users are redirected to /not-found instead of /not-authorized
 * to avoid revealing the existence of protected pages.
 */

'use client'

import React from 'react'
import { ProtectedRoute as SharedProtectedRoute } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { isAuthorizedProviderUser, isProviderAdmin } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireProviderAdmin?: boolean
  requireProviderRole?: boolean
  /**
   * Require the user to hold at least one of these permission ids (in addition
   * to any role requirement). Used to gate feature pages such as Messaging.
   * Impersonated superadmin sessions bypass the permission check.
   */
  requiredPermissions?: string[]
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireProviderAdmin = false,
  requireProviderRole = false,
  requiredPermissions,
}: ProtectedRouteProps) {
  // Determine which role check to use
  let checkRoleFn: ((user: any) => boolean) | undefined
  let requireRoleValue: string | undefined

  if (requireProviderAdmin) {
    checkRoleFn = isProviderAdmin
    requireRoleValue = 'Provider Admin'
  } else if (requireProviderRole) {
    // Impersonated sessions are always authorized — the superadmin has been granted access
    // via a server-issued JWT. This handles admin-created providers that may have no DB roles.
    checkRoleFn = user => isAuthorizedProviderUser(user) || !!(user as any)?.isImpersonated
    requireRoleValue = 'provider-role'
  }

  // Layer a permission requirement on top of the role check, if requested.
  if (requiredPermissions?.length) {
    const baseRoleCheck = checkRoleFn
    checkRoleFn = user => {
      if ((user as any)?.isImpersonated) return true
      const roleOk = baseRoleCheck ? baseRoleCheck(user) : true
      const perms: string[] = (user as any)?.permissions ?? []
      return roleOk && requiredPermissions.some(p => perms.includes(p))
    }
    requireRoleValue = requireRoleValue ?? 'permission'
  }

  return (
    <SharedProtectedRoute
      useAuthStore={useAuthStore}
      requireAuth={requireAuth}
      requireRole={requireRoleValue}
      checkRole={checkRoleFn}
      unauthorizedRedirect="/not-found"
    >
      {children}
    </SharedProtectedRoute>
  )
}
