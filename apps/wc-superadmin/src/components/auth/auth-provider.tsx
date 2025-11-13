'use client'

import React, { useEffect, useState } from 'react'

import { useAuthStore } from '@/stores/auth-store'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { initialize } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        initialize()
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsInitialized(true)
      }
    }

    void init()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Preparing console...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
