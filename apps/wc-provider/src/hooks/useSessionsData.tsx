'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session, SessionsResponse } from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface UseSessionsDataReturn {
  sessions: Session[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Custom hook for fetching and caching session data
 */
export function useSessionsData(campId: string, sortBy?: string): UseSessionsDataReturn {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!campId) return

    setIsLoading(true)
    setError(null)

    try {
      const response: SessionsResponse = await sessionsService.getAllSessions(campId, sortBy)
      setSessions(response.sessions)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load sessions'
      setError(errorMessage)
      console.error('Failed to load sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [campId, sortBy])

  // Initial load
  useEffect(() => {
    loadSessions().catch(error => {
      console.error('Failed to load sessions:', error)
    })
  }, [loadSessions])

  // Reload function
  const reload = useCallback(async () => {
    await loadSessions()
  }, [loadSessions])

  return {
    sessions,
    isLoading,
    error,
    reload,
  }
}
