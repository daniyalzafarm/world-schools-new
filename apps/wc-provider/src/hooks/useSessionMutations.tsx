'use client'

import { useCallback, useState } from 'react'
import type {
  CreateFixedSessionDto,
  CreateFlexibleSessionDto,
  DeleteSessionResponse,
  FixedSession,
  FlexibleSession,
  SessionResponse,
  SessionType,
  UpdateFixedSessionDto,
  UpdateFlexibleSessionDto,
  UpdateSessionTypeDto,
} from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface MutationCallbacks {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseSessionMutationsReturn {
  // Session Type
  setSessionType: (type: SessionType, callbacks?: MutationCallbacks) => Promise<void>
  isSettingType: boolean

  // Flexible Sessions
  createFlexibleSession: (
    data: CreateFlexibleSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<FlexibleSession | null>
  updateFlexibleSession: (
    sessionId: string,
    data: UpdateFlexibleSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<FlexibleSession | null>
  isCreatingFlexible: boolean
  isUpdatingFlexible: boolean

  // Fixed Sessions
  createFixedSession: (
    data: CreateFixedSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<FixedSession | null>
  updateFixedSession: (
    sessionId: string,
    data: UpdateFixedSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<FixedSession | null>
  duplicateFixedSession: (
    sessionId: string,
    callbacks?: MutationCallbacks
  ) => Promise<FixedSession | null>
  isCreatingFixed: boolean
  isUpdatingFixed: boolean
  isDuplicating: boolean

  // Common Operations
  deleteSession: (sessionId: string, callbacks?: MutationCallbacks) => Promise<boolean>
  toggleSessionStatus: (
    sessionId: string,
    callbacks?: MutationCallbacks
  ) => Promise<FlexibleSession | FixedSession | null>
  isDeleting: boolean
  isToggling: boolean

  // General state
  error: string | null
  clearError: () => void
}

/**
 * Custom hook for session CRUD operations
 * Handles all mutations with loading states and error handling
 */
export function useSessionMutations(campId: string): UseSessionMutationsReturn {
  const [isSettingType, setIsSettingType] = useState(false)
  const [isCreatingFlexible, setIsCreatingFlexible] = useState(false)
  const [isUpdatingFlexible, setIsUpdatingFlexible] = useState(false)
  const [isCreatingFixed, setIsCreatingFixed] = useState(false)
  const [isUpdatingFixed, setIsUpdatingFixed] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Set session type
  const setSessionType = useCallback(
    async (type: SessionType, callbacks?: MutationCallbacks) => {
      setIsSettingType(true)
      setError(null)

      try {
        const dto: UpdateSessionTypeDto = { sessionType: type }
        await sessionsService.setSessionType(campId, dto)
        callbacks?.onSuccess?.()
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to set session type'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to set session type:', err)
      } finally {
        setIsSettingType(false)
      }
    },
    [campId]
  )

  // Create flexible session
  const createFlexibleSession = useCallback(
    async (data: CreateFlexibleSessionDto, callbacks?: MutationCallbacks) => {
      setIsCreatingFlexible(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.createFlexibleSession(campId, data)
        callbacks?.onSuccess?.()
        return response.session as FlexibleSession
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to create flexible session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to create flexible session:', err)
        return null
      } finally {
        setIsCreatingFlexible(false)
      }
    },
    [campId]
  )

  // Update flexible session
  const updateFlexibleSession = useCallback(
    async (sessionId: string, data: UpdateFlexibleSessionDto, callbacks?: MutationCallbacks) => {
      setIsUpdatingFlexible(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.updateFlexibleSession(
          campId,
          sessionId,
          data
        )
        callbacks?.onSuccess?.()
        return response.session as FlexibleSession
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update flexible session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to update flexible session:', err)
        return null
      } finally {
        setIsUpdatingFlexible(false)
      }
    },
    [campId]
  )

  // Create fixed session
  const createFixedSession = useCallback(
    async (data: CreateFixedSessionDto, callbacks?: MutationCallbacks) => {
      setIsCreatingFixed(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.createFixedSession(campId, data)
        callbacks?.onSuccess?.()
        return response.session as FixedSession
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to create fixed session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to create fixed session:', err)
        return null
      } finally {
        setIsCreatingFixed(false)
      }
    },
    [campId]
  )

  // Update fixed session
  const updateFixedSession = useCallback(
    async (sessionId: string, data: UpdateFixedSessionDto, callbacks?: MutationCallbacks) => {
      setIsUpdatingFixed(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.updateFixedSession(
          campId,
          sessionId,
          data
        )
        callbacks?.onSuccess?.()
        return response.session as FixedSession
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update fixed session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to update fixed session:', err)
        return null
      } finally {
        setIsUpdatingFixed(false)
      }
    },
    [campId]
  )

  // Duplicate fixed session
  const duplicateFixedSession = useCallback(
    async (sessionId: string, callbacks?: MutationCallbacks) => {
      setIsDuplicating(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.duplicateFixedSession(
          campId,
          sessionId
        )
        callbacks?.onSuccess?.()
        return response.session as FixedSession
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to duplicate session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to duplicate session:', err)
        return null
      } finally {
        setIsDuplicating(false)
      }
    },
    [campId]
  )

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string, callbacks?: MutationCallbacks) => {
      setIsDeleting(true)
      setError(null)

      try {
        await sessionsService.deleteSession(campId, sessionId)
        callbacks?.onSuccess?.()
        return true
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to delete session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to delete session:', err)
        return false
      } finally {
        setIsDeleting(false)
      }
    },
    [campId]
  )

  // Toggle session status
  const toggleSessionStatus = useCallback(
    async (sessionId: string, callbacks?: MutationCallbacks) => {
      setIsToggling(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.toggleSessionStatus(
          campId,
          sessionId
        )
        callbacks?.onSuccess?.()
        return response.session
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to toggle session status'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to toggle session status:', err)
        return null
      } finally {
        setIsToggling(false)
      }
    },
    [campId]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Session Type
    setSessionType,
    isSettingType,

    // Flexible Sessions
    createFlexibleSession,
    updateFlexibleSession,
    isCreatingFlexible,
    isUpdatingFlexible,

    // Fixed Sessions
    createFixedSession,
    updateFixedSession,
    duplicateFixedSession,
    isCreatingFixed,
    isUpdatingFixed,
    isDuplicating,

    // Common Operations
    deleteSession,
    toggleSessionStatus,
    isDeleting,
    isToggling,

    // General state
    error,
    clearError,
  }
}
