'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  FixedSession,
  FixedSessionsResponse,
  FlexibleSession,
  FlexibleSessionsResponse,
  SessionType,
  SessionTypeResponse,
} from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface UseSessionsDataReturn {
  sessionType: SessionType | null
  canChangeType: boolean
  sessions: (FlexibleSession | FixedSession)[]
  flexibleSessions: FlexibleSession[]
  fixedSessions: FixedSession[]
  isLoading: boolean
  isLoadingType: boolean
  isLoadingSessions: boolean
  error: string | null
  reload: () => Promise<void>
  reloadType: () => Promise<void>
  reloadSessions: () => Promise<void>
}

/**
 * Custom hook for fetching and caching session data
 * Handles loading session type and sessions based on type
 */
export function useSessionsData(campId: string): UseSessionsDataReturn {
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [canChangeType, setCanChangeType] = useState(false)
  const [flexibleSessions, setFlexibleSessions] = useState<FlexibleSession[]>([])
  const [fixedSessions, setFixedSessions] = useState<FixedSession[]>([])
  const [isLoadingType, setIsLoadingType] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load session type
  const loadSessionType = useCallback(async () => {
    if (!campId) return

    setIsLoadingType(true)
    setError(null)

    try {
      const response: SessionTypeResponse = await sessionsService.getSessionType(campId)
      setSessionType(response.sessionType)
      setCanChangeType(response.canChange)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load session type'
      setError(errorMessage)
      console.error('Failed to load session type:', err)
    } finally {
      setIsLoadingType(false)
    }
  }, [campId])

  // Load sessions based on type
  const loadSessions = useCallback(async () => {
    if (!campId || !sessionType) return

    setIsLoadingSessions(true)
    setError(null)

    try {
      if (sessionType === 'flexible') {
        const response: FlexibleSessionsResponse = await sessionsService.getFlexibleSessions(campId)
        setFlexibleSessions(response.sessions)
        setFixedSessions([])
      } else if (sessionType === 'fixed') {
        const response: FixedSessionsResponse = await sessionsService.getFixedSessions(campId)
        setFixedSessions(response.sessions)
        setFlexibleSessions([])
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load sessions'
      setError(errorMessage)
      console.error('Failed to load sessions:', err)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [campId, sessionType])

  // Initial load of session type
  useEffect(() => {
    loadSessionType().catch(error => {
      console.error('Failed to load session type:', error)
    })
  }, [loadSessionType])

  // Load sessions when type changes
  useEffect(() => {
    if (sessionType) {
      loadSessions().catch(error => {
        console.error('Failed to load sessions:', error)
      })
    }
  }, [sessionType, loadSessions])

  // Reload functions
  const reloadType = useCallback(async () => {
    await loadSessionType()
  }, [loadSessionType])

  const reloadSessions = useCallback(async () => {
    await loadSessions()
  }, [loadSessions])

  const reload = useCallback(async () => {
    await loadSessionType()
    // Sessions will reload automatically via useEffect when type changes
  }, [loadSessionType])

  // Combined sessions array
  const sessions = sessionType === 'flexible' ? flexibleSessions : fixedSessions

  return {
    sessionType,
    canChangeType,
    sessions,
    flexibleSessions,
    fixedSessions,
    isLoading: isLoadingType || isLoadingSessions,
    isLoadingType,
    isLoadingSessions,
    error,
    reload,
    reloadType,
    reloadSessions,
  }
}
