/**
 * Authentication Provider Component for World Camps Applications
 *
 * This component initializes authentication on app mount and shows a loading
 * state during initialization. It wraps the app with auth context.
 *
 * @example
 * ```typescript
 * import { createAuthStore, AuthProvider } from '@world-schools/wc-utils'
 *
 * const { useAuthStore } = createAuthStore({ ... })
 *
 * function App({ children }) {
 *   return (
 *     <AuthProvider useAuthStore={useAuthStore}>
 *       {children}
 *     </AuthProvider>
 *   )
 * }
 * ```
 */

'use client'

import React, { useEffect } from 'react'

interface AuthProviderProps {
  children: React.ReactNode
  /**
   * The useAuthStore hook from createAuthStore
   */
  useAuthStore: () => {
    initialize: () => Promise<void>
    isInitialized: boolean
  }
  /**
   * Optional custom loading component
   */
  loadingComponent?: React.ReactNode
  /**
   * Optional loading message
   */
  loadingMessage?: string
}

export function AuthProvider({
  children,
  useAuthStore,
  loadingComponent,
  loadingMessage = 'Preparing console...',
}: AuthProviderProps) {
  const { initialize, isInitialized } = useAuthStore()

  useEffect(() => {
    const init = async () => {
      try {
        await initialize()
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error)
      }
    }

    // Only initialize if not already initialized
    if (!isInitialized) {
      void init()
    }
  }, [initialize, isInitialized])

  if (!isInitialized) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

