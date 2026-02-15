'use client'

import { useCallback, useState } from 'react'
import type { CreateSessionDto, Session, SessionResponse, UpdateSessionDto } from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface MutationCallbacks {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseSessionMutationsReturn {
  // Session Operations
  createSession: (data: CreateSessionDto, callbacks?: MutationCallbacks) => Promise<Session | null>
  updateSession: (
    sessionId: string,
    data: UpdateSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<Session | null>
  duplicateSession: (sessionId: string, callbacks?: MutationCallbacks) => Promise<Session | null>
  deleteSession: (sessionId: string, callbacks?: MutationCallbacks) => Promise<boolean>
  toggleSessionStatus: (sessionId: string, callbacks?: MutationCallbacks) => Promise<Session | null>
  updateSessionSpots: (
    sessionId: string,
    spots: number | Record<string, number>,
    callbacks?: MutationCallbacks
  ) => Promise<Session | null>

  // Loading states
  isCreating: boolean
  isUpdating: boolean
  isDuplicating: boolean
  isDeleting: boolean
  isToggling: boolean
  isUpdatingSpots: boolean

  // General state
  error: string | null
  clearError: () => void
}

/**
 * Custom hook for session CRUD operations
 * Handles all mutations with loading states and error handling
 */
export function useSessionMutations(campId: string): UseSessionMutationsReturn {
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [isUpdatingSpots, setIsUpdatingSpots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create session
  const createSession = useCallback(
    async (data: CreateSessionDto, callbacks?: MutationCallbacks) => {
      setIsCreating(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.createSession(campId, data)
        callbacks?.onSuccess?.()
        return response.session
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to create session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to create session:', err)
        return null
      } finally {
        setIsCreating(false)
      }
    },
    [campId]
  )

  // Update session
  const updateSession = useCallback(
    async (sessionId: string, data: UpdateSessionDto, callbacks?: MutationCallbacks) => {
      setIsUpdating(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.updateSession(
          campId,
          sessionId,
          data
        )
        callbacks?.onSuccess?.()
        return response.session
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update session'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to update session:', err)
        return null
      } finally {
        setIsUpdating(false)
      }
    },
    [campId]
  )

  // Duplicate session
  const duplicateSession = useCallback(
    async (sessionId: string, callbacks?: MutationCallbacks) => {
      setIsDuplicating(true)
      setError(null)

      try {
        const response: SessionResponse = await sessionsService.duplicateSession(campId, sessionId)
        callbacks?.onSuccess?.()
        return response.session
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

  // Update session spots
  const updateSessionSpots = useCallback(
    async (
      sessionId: string,
      spots: number | Record<string, number>,
      callbacks?: MutationCallbacks
    ) => {
      setIsUpdatingSpots(true)
      setError(null)

      try {
        // Determine if it's single or age group availability
        const updateData: UpdateSessionDto =
          typeof spots === 'number'
            ? { totalSpots: spots }
            : {
                ageGroupSpots: Object.entries(spots).map(([ageGroupId, spotsCount]) => ({
                  ageGroupId,
                  spots: spotsCount,
                })),
              }

        const response: SessionResponse = await sessionsService.updateSession(
          campId,
          sessionId,
          updateData
        )
        callbacks?.onSuccess?.()
        return response.session
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update session spots'
        setError(errorMessage)
        callbacks?.onError?.(err)
        console.error('Failed to update session spots:', err)
        return null
      } finally {
        setIsUpdatingSpots(false)
      }
    },
    [campId]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Session Operations
    createSession,
    updateSession,
    duplicateSession,
    deleteSession,
    toggleSessionStatus,
    updateSessionSpots,

    // Loading states
    isCreating,
    isUpdating,
    isDuplicating,
    isDeleting,
    isToggling,
    isUpdatingSpots,

    // General state
    error,
    clearError,
  }
}
