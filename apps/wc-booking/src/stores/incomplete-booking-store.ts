import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BookingFlowStep } from '@/types/camp-booking'

/**
 * Snapshot of an in-progress booking before the draft is created on the server
 * (the draft only exists after the Children step). Persisted to localStorage so
 * the "Incomplete booking" banner can offer the parent a way back after they
 * navigate out of the flow — e.g. to add a missing emergency contact — without
 * losing their session + children selection.
 */
export interface IncompleteBookingSnapshot {
  campSlug: string
  campName: string
  sessionId: string | null
  childIds: string[]
  childCount: number
  step: BookingFlowStep
  /** Set once a server draft exists; lets "Continue" resume via `?bookingGroupId=`. */
  bookingGroupId: string | null
  updatedAt: number
}

/** Ignore snapshots older than this — avoids resurrecting a stale booking days later. */
export const INCOMPLETE_BOOKING_TTL_MS = 24 * 60 * 60 * 1000

/** True when a snapshot exists and hasn't aged past its TTL. */
export function isSnapshotActive(snapshot: IncompleteBookingSnapshot | null): boolean {
  if (!snapshot) return false
  return Date.now() - snapshot.updatedAt < INCOMPLETE_BOOKING_TTL_MS
}

interface IncompleteBookingState {
  snapshot: IncompleteBookingSnapshot | null
  save: (snapshot: Omit<IncompleteBookingSnapshot, 'childCount' | 'updatedAt'>) => void
  clear: () => void
}

export const useIncompleteBookingStore = create<IncompleteBookingState>()(
  persist(
    set => ({
      snapshot: null,
      save: snapshot =>
        set({
          snapshot: {
            ...snapshot,
            childCount: snapshot.childIds.length,
            updatedAt: Date.now(),
          },
        }),
      clear: () => set({ snapshot: null }),
    }),
    {
      name: 'wc-incomplete-booking',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
