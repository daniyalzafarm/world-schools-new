/**
 * Sessions Store for WC Provider
 *
 * Zustand store for managing sessions state with real-time updates
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { Session } from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface SessionsState {
  // State
  sessions: Session[]
  isLoading: boolean
  error: string | null
  currentCampId: string | null
  sortBy: string | undefined

  // Actions
  loadSessions: (campId: string, sortBy?: string) => Promise<void>
  reload: () => Promise<void>
  getSessionById: (sessionId: string) => Session | undefined
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  clearSessions: () => void
  setError: (error: string | null) => void
}

// Initial state
const initialState = {
  sessions: [],
  isLoading: false,
  error: null,
  currentCampId: null,
  sortBy: undefined,
}

export const useSessionsStore = create<SessionsState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Load sessions for a camp
      loadSessions: async (campId: string, sortBy?: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
          draft.currentCampId = campId
          draft.sortBy = sortBy
        })

        try {
          const response = await sessionsService.getAllSessions(campId, sortBy)
          set(draft => {
            draft.sessions = response.sessions
            draft.isLoading = false
          })
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to load sessions'
          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          console.error('Failed to load sessions:', err)
        }
      },

      // Reload sessions using current campId and sortBy
      reload: async () => {
        const { currentCampId, sortBy } = get()
        if (currentCampId) {
          await get().loadSessions(currentCampId, sortBy)
        }
      },

      // Get a specific session by ID
      getSessionById: (sessionId: string) => {
        return get().sessions.find(s => s.id === sessionId)
      },

      // Update a specific session in the store
      updateSession: (sessionId: string, updates: Partial<Session>) => {
        set(draft => {
          const index = draft.sessions.findIndex(s => s.id === sessionId)
          if (index !== -1) {
            draft.sessions[index] = { ...draft.sessions[index], ...updates }
          }
        })
      },

      // Clear all sessions
      clearSessions: () => {
        set(draft => {
          draft.sessions = []
          draft.currentCampId = null
          draft.sortBy = undefined
        })
      },

      // Set error
      setError: (error: string | null) => {
        set(draft => {
          draft.error = error
        })
      },
    })),
    { name: 'sessions-store' }
  )
)
