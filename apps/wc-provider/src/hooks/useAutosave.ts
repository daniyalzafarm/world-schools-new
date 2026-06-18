'use client'

import { useEffect, useRef } from 'react'
import { useCampsStore } from '../stores/camps-store'

interface UseAutosaveOptions<T> {
  enabled?: boolean
  /**
   * Signals that `payload` now reflects loaded/persisted data, so the baseline
   * can be captured. Defaults to `enabled`. Pass a separate load flag (distinct
   * from a validity gate) so a form that loads invalid still snapshots its
   * baseline and doesn't swallow the first edit that makes it valid.
   */
  ready?: boolean
  debounceMs?: number
  /**
   * Persist `payload`. May return a canonical form (e.g. server-normalized response);
   * when returned, it becomes the new baseline so a subsequent `setState(canonical)`
   * doesn't register as a diff and re-save.
   */
  save: (payload: T) => Promise<T | void>
}

interface UseAutosaveResult {
  flush: () => Promise<void>
}

const DEFAULT_DEBOUNCE_MS = 1500
const SAVED_INDICATOR_MS = 2000

export function useAutosave<T>(
  payload: T,
  { enabled = true, ready = enabled, debounceMs = DEFAULT_DEBOUNCE_MS, save }: UseAutosaveOptions<T>
): UseAutosaveResult {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const baselineRef = useRef<string | null>(null)
  const pendingPayloadRef = useRef<T | null>(null)
  const saveRef = useRef(save)
  const enabledRef = useRef(enabled)
  const readyRef = useRef(ready)

  saveRef.current = save
  enabledRef.current = enabled
  readyRef.current = ready

  const performSave = async (data: T): Promise<void> => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }

    useCampsStore.setState({ autoSaveStatus: 'saving', hasPendingAutoSave: true })

    const promise = (async () => {
      try {
        const canonical = await saveRef.current(data)
        if (useCampsStore.getState().error) {
          useCampsStore.setState({ autoSaveStatus: 'error', hasPendingAutoSave: false })
          return
        }
        baselineRef.current = JSON.stringify(canonical ?? data)
        useCampsStore.setState({
          autoSaveStatus: 'saved',
          hasPendingAutoSave: false,
          hasUnsavedChanges: false,
        })
        savedTimerRef.current = setTimeout(() => {
          if (useCampsStore.getState().autoSaveStatus === 'saved') {
            useCampsStore.setState({ autoSaveStatus: 'idle' })
          }
          savedTimerRef.current = null
        }, SAVED_INDICATOR_MS)
      } catch {
        useCampsStore.setState({ autoSaveStatus: 'error', hasPendingAutoSave: false })
      }
    })()

    inFlightRef.current = promise
    try {
      await promise
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null
    }
  }

  const flushRef = useRef<() => Promise<void>>(async () => {})
  flushRef.current = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (inFlightRef.current) {
      await inFlightRef.current
    }
    if (pendingPayloadRef.current !== null) {
      const data = pendingPayloadRef.current
      pendingPayloadRef.current = null
      await performSave(data)
    }
  }

  useEffect(() => {
    const serialized = JSON.stringify(payload)

    // First time the data is ready (initial load) — snapshot the baseline without
    // saving, so loading server data doesn't register as a diff and resave. Keyed
    // on `ready` (not `enabled`) so a form that loads in an invalid state still
    // captures its baseline and doesn't swallow the first edit that fixes it.
    if (baselineRef.current === null) {
      if (readyRef.current) baselineRef.current = serialized
      return
    }

    // While disabled (validation errors), pause autosave but keep the baseline
    // pointing at the last persisted value. This way an edit made while transiently
    // invalid (e.g. clearing a number field before typing the new value) is still
    // detected and saved once the form becomes valid again.
    if (!enabledRef.current) {
      pendingPayloadRef.current = null
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (serialized === baselineRef.current) return

    pendingPayloadRef.current = payload
    useCampsStore.setState({ hasPendingAutoSave: true, hasUnsavedChanges: true })

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const data = pendingPayloadRef.current
      pendingPayloadRef.current = null
      if (data !== null) void performSave(data)
    }, debounceMs)
  }, [payload, enabled, ready, debounceMs])

  // Register flush on the store so the footer can call it before navigation.
  useEffect(() => {
    const stableFlush = () => flushRef.current()
    useCampsStore.getState().setAutoSaveFlush(stableFlush)
    return () => {
      const current = useCampsStore.getState().autoSaveFlush
      if (current === stableFlush) {
        useCampsStore.getState().setAutoSaveFlush(null)
      }
    }
  }, [])

  // Cleanup on unmount: clear timers and flush any pending payload.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
      const data = pendingPayloadRef.current
      pendingPayloadRef.current = null
      if (data !== null) {
        void performSave(data)
      } else {
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
      }
    }
  }, [])

  return { flush: () => flushRef.current() }
}
