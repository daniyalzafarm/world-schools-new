/**
 * Authentication Provider for WC Booking
 *
 * This component uses the shared AuthProvider from @world-schools/wc-frontend-utils
 * configured with the booking auth store.
 */

'use client'

import React from 'react'
import { AuthProvider as SharedAuthProvider } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SharedAuthProvider useAuthStore={useAuthStore} loadingMessage="Loading...">
      {children}
    </SharedAuthProvider>
  )
}
