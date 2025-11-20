/**
 * Protected Route Component for WC Booking
 *
 * This component uses the shared ProtectedRoute from @world-schools/wc-frontend-utils
 * configured with the booking auth store and role checking.
 *
 * Security Note: Unauthorized users are redirected to /not-found instead of /not-authorized
 * to avoid revealing the existence of protected pages.
 */

'use client'

import React from 'react'
import { ProtectedRoute as SharedProtectedRoute } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { isAuthorizedBookingUser } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireParentRole?: boolean
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireParentRole = false,
}: ProtectedRouteProps) {
  // Determine which role check to use
  let checkRoleFn: ((user: any) => boolean) | undefined
  let requireRoleValue: string | undefined

  if (requireParentRole) {
    // Check if user has Parent role
    checkRoleFn = isAuthorizedBookingUser
    requireRoleValue = 'Parent'
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
