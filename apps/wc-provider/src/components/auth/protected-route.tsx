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
import { isProviderAdmin, isAuthorizedProviderUser } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireProviderAdmin?: boolean
  requireProviderRole?: boolean
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireProviderAdmin = false,
  requireProviderRole = false,
}: ProtectedRouteProps) {
  // Determine which role check to use
  let checkRoleFn: ((user: any) => boolean) | undefined
  let requireRoleValue: string | undefined

  if (requireProviderAdmin) {
    checkRoleFn = isProviderAdmin
    requireRoleValue = 'Provider Admin'
  } else if (requireProviderRole) {
    // Check if user has any provider-specific role
    checkRoleFn = isAuthorizedProviderUser
    requireRoleValue = 'provider-role'
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
