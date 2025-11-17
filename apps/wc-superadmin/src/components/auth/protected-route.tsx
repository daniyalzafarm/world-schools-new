/**
 * Protected Route Component for WC Superadmin
 *
 * This component uses the shared ProtectedRoute from @world-schools/wc-utils
 * configured with the superadmin auth store and role checking.
 */

'use client'

import React from 'react'
import { ProtectedRoute as SharedProtectedRoute } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { isSuperAdmin } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireSuperAdmin?: boolean
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  return (
    <SharedProtectedRoute
      useAuthStore={useAuthStore}
      requireAuth={requireAuth}
      requireRole={requireSuperAdmin ? 'Super Admin' : undefined}
      checkRole={requireSuperAdmin ? isSuperAdmin : undefined}
    >
      {children}
    </SharedProtectedRoute>
  )
}
