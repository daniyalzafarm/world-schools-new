import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { childrenService } from '@/services/children.services'
import { getCampBySlug } from '@/services/camps.services'
import { campSessionsService } from '@/services/camp-sessions.services'
import { campAddOnsService } from '@/services/camp-addons.services'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { Camp } from '@/types/camps'
import type { Child } from '@/types/child'
import type { Session } from '@/types/sessions'
import type {
  BookingFlowStep,
  CampBookingAddOn,
  CampBookingAddOnSelection,
  CampBookingAddOnSelectionMode,
  CampBookingChildQuantity,
  SaveBookingGroupAddOnsRequest,
} from '@/types/camp-booking'

interface CampBookingState {
  campSlug: string | null
  camp: Camp | null
  sessions: Session[]
  children: Child[]
  addOns: CampBookingAddOn[]
  selectedSessionId: string | null
  selectedChildIds: string[]
  addOnSelectionsById: Record<string, CampBookingAddOnSelection>
  currentStep: BookingFlowStep
  bookingGroupId: string | null
  hasSubmitted: boolean
  isLoading: boolean
  error: string | null
}

interface CampBookingActions {
  initByCampSlug: (campSlug: string) => Promise<void>
  hydrateFromBookingGroupId: (bookingGroupId: string) => Promise<void>
  setStep: (step: BookingFlowStep) => void
  selectSession: (sessionId: string | null) => void
  toggleChild: (childId: string) => void
  addChild: (child: {
    firstName: string
    lastName?: string
    dateOfBirth: string
    gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
  }) => Promise<Child | null>
  createDraftBookingGroup: () => Promise<string | null>
  toggleAddOn: (addOnId: string) => void
  toggleAddOnChild: (addOnId: string, childId: string) => void
  setAddOnChildQuantity: (addOnId: string, childId: string, quantity: number) => void
  setAddOnQuantity: (addOnId: string, quantity: number) => void
  saveAddOnsAndGoToReview: () => Promise<boolean>
  submitBookingGroup: () => Promise<boolean>
  setSpecialRequest: (value: string) => void
  resetForNewBooking: () => void
  specialRequest: string
}

type CampBookingStore = CampBookingState & CampBookingActions

const START_STEP: BookingFlowStep = 'sessions'

export const useCampBookingStore = create<CampBookingStore>()(
  immer((set, get) => ({
    campSlug: null,
    camp: null,
    sessions: [],
    children: [],
    addOns: [],
    selectedSessionId: null,
    selectedChildIds: [],
    addOnSelectionsById: {},
    currentStep: START_STEP,
    bookingGroupId: null,
    hasSubmitted: false,
    isLoading: false,
    error: null,
    specialRequest: '',

    initByCampSlug: async campSlug => {
      set(state => {
        state.isLoading = true
        state.error = null
        state.campSlug = campSlug
      })

      try {
        const camp = await getCampBySlug(campSlug)
        const [sessionsResponse, childrenResponse, addOnsResponse] = await Promise.all([
          campSessionsService.getByCampId(camp.id),
          childrenService.getAll(),
          campAddOnsService.getByCampId(camp.id),
        ])

        if (!sessionsResponse.success) throw new Error((sessionsResponse.data as any)?.message)
        if (!childrenResponse.success) throw new Error((childrenResponse.data as any)?.message)
        if (!addOnsResponse.success) throw new Error((addOnsResponse.data as any)?.message)

        set(state => {
          state.camp = camp
          state.sessions = sessionsResponse.data
          state.children = childrenResponse.data
          state.addOns = addOnsResponse.data
          state.currentStep = START_STEP
          state.bookingGroupId = null
          state.hasSubmitted = false
          state.isLoading = false
        })
      } catch (error: any) {
        set(state => {
          state.error = error?.message ?? 'Failed to initialize booking flow'
          state.isLoading = false
        })
      }
    },

    hydrateFromBookingGroupId: async bookingGroupId => {
      set(state => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await bookingGroupsService.getById(bookingGroupId)
        if (!response.success) throw new Error((response.data as any)?.message)
        const details = response.data
        const selectedChildIds = details.bookings.map(item => item.childId)

        set(state => {
          state.bookingGroupId = details.id
          state.selectedSessionId = details.sessionId
          state.selectedChildIds = selectedChildIds
          state.specialRequest = details.specialRequest ?? ''
          state.hasSubmitted = details.status !== 'draft'

          const hasReviewMarker =
            details.specialRequest !== null && details.specialRequest !== undefined
          const hasAnySavedAddOns = details.bookings.some(b => (b.addOns?.length ?? 0) > 0)

          if (details.status !== 'draft' || hasReviewMarker) {
            state.currentStep = 'review-and-pay'
          } else if (selectedChildIds.length > 0) {
            state.currentStep = 'addons'
          } else {
            state.currentStep = 'children'
          }

          // Hydrate per-child addon selections from persisted bookingCampAddOn rows.
          const addOnSelectionsById: Record<string, CampBookingAddOnSelection> = {}

          // Deterministic booking order (used for qty mode where we store only once).
          const orderedBookings = [...details.bookings].sort((a, b) =>
            a.childId.localeCompare(b.childId)
          )
          const firstBooking = orderedBookings[0]

          for (const booking of details.bookings) {
            for (const savedAddOn of booking.addOns ?? []) {
              const addOnId = savedAddOn.addOnId
              const savedQty = savedAddOn.quantity ?? 0
              if (!savedQty || savedQty <= 0) continue

              // Determine selection mode from the local add-on config.
              const addOnConfig = state.addOns.find(a => a.addOnId === addOnId)
              const mode = inferAddOnMode(addOnConfig)

              if (!addOnSelectionsById[addOnId]) {
                if (mode === 'per_child') {
                  addOnSelectionsById[addOnId] = { addOnId, mode, childIds: [] }
                } else if (mode === 'per_child_qty') {
                  addOnSelectionsById[addOnId] = { addOnId, mode, childQuantities: [] }
                } else {
                  addOnSelectionsById[addOnId] = { addOnId, mode, quantity: 0 }
                }
              }

              const sel = addOnSelectionsById[addOnId]
              if (mode === 'per_child') {
                if (!sel.childIds!.includes(booking.childId)) sel.childIds!.push(booking.childId)
              } else if (mode === 'per_child_qty') {
                sel.childQuantities ??= []
                const existing = sel.childQuantities.find(cq => cq.childId === booking.childId)
                if (existing) existing.quantity = savedQty
                else sel.childQuantities.push({ childId: booking.childId, quantity: savedQty })
              } else {
                // qty mode: take from the first booking only.
                if (firstBooking && booking.childId === firstBooking.childId) {
                  sel.quantity = savedQty
                }
              }
            }
          }

          // Clean up empty selections (e.g. qty mode saved 0).
          for (const [addOnId, sel] of Object.entries(addOnSelectionsById)) {
            if (sel.mode === 'per_child' && (sel.childIds?.length ?? 0) === 0) {
              delete addOnSelectionsById[addOnId]
            }
            if (sel.mode === 'per_child_qty' && (sel.childQuantities?.length ?? 0) === 0) {
              delete addOnSelectionsById[addOnId]
            }
            if (sel.mode === 'qty' && (sel.quantity ?? 0) <= 0) {
              delete addOnSelectionsById[addOnId]
            }
          }

          state.addOnSelectionsById = addOnSelectionsById
          state.isLoading = false
          void hasAnySavedAddOns
        })
      } catch (error: any) {
        set(state => {
          state.error = error?.message ?? 'Failed to load booking group'
          state.isLoading = false
        })
      }
    },

    setStep: step => {
      set(state => {
        state.currentStep = step
      })
    },

    selectSession: sessionId => {
      set(state => {
        state.selectedSessionId = sessionId
      })
    },

    toggleChild: childId => {
      set(state => {
        const isSelected = state.selectedChildIds.includes(childId)
        if (isSelected) {
          state.selectedChildIds = state.selectedChildIds.filter(id => id !== childId)
        } else {
          state.selectedChildIds.push(childId)
        }
      })
    },

    addChild: async childData => {
      try {
        const response = await childrenService.create(childData)
        if (!response.success) throw new Error((response.data as any)?.message)

        const createdChild = response.data
        set(state => {
          state.children.push(createdChild)
          state.error = null
        })

        return createdChild
      } catch (error: any) {
        set(state => {
          state.error = error?.message ?? 'Failed to create child'
        })
        return null
      }
    },

    toggleAddOn: addOnId => {
      set(state => {
        if (state.addOnSelectionsById[addOnId]) {
          delete state.addOnSelectionsById[addOnId]
          return
        }

        const addOnConfig = state.addOns.find(a => a.addOnId === addOnId)
        const mode = inferAddOnMode(addOnConfig)

        if (mode === 'per_child') {
          state.addOnSelectionsById[addOnId] = {
            addOnId,
            mode,
            childIds: [...state.selectedChildIds],
          }
        } else if (mode === 'per_child_qty') {
          const childQuantities: CampBookingChildQuantity[] = state.selectedChildIds.map(
            childId => ({ childId, quantity: 1 })
          )
          state.addOnSelectionsById[addOnId] = {
            addOnId,
            mode,
            childQuantities,
          }
        } else {
          state.addOnSelectionsById[addOnId] = {
            addOnId,
            mode,
            quantity: 1,
          }
        }
      })
    },

    toggleAddOnChild: (addOnId, childId) => {
      set(state => {
        const sel = state.addOnSelectionsById[addOnId]
        if (sel?.mode !== 'per_child') return
        const ids = sel.childIds ?? []
        const idx = ids.indexOf(childId)
        if (idx >= 0) ids.splice(idx, 1)
        else ids.push(childId)

        if (ids.length === 0) {
          delete state.addOnSelectionsById[addOnId]
          return
        }

        sel.childIds = ids
      })
    },

    setAddOnChildQuantity: (addOnId, childId, quantity) => {
      set(state => {
        const sel = state.addOnSelectionsById[addOnId]
        if (sel?.mode !== 'per_child_qty') return
        const safeQty = Math.max(0, quantity)
        const list = sel.childQuantities ?? []
        const existing = list.find(x => x.childId === childId)
        if (!existing) {
          if (safeQty <= 0) return
          list.push({ childId, quantity: safeQty })
        } else {
          existing.quantity = safeQty
        }

        const cleaned = list.filter(x => x.quantity > 0)
        if (cleaned.length === 0) {
          delete state.addOnSelectionsById[addOnId]
          return
        }
        sel.childQuantities = cleaned
      })
    },

    setAddOnQuantity: (addOnId, quantity) => {
      set(state => {
        const sel = state.addOnSelectionsById[addOnId]
        if (!sel) return
        if (sel.mode !== 'qty') return

        const safeQty = Math.max(0, quantity)
        if (safeQty <= 0) {
          delete state.addOnSelectionsById[addOnId]
          return
        }
        sel.quantity = safeQty
      })
    },

    saveAddOnsAndGoToReview: async () => {
      const state = get()
      if (!state.bookingGroupId) return false

      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        const payload = buildSaveAddOnsPayload(state)
        const response = await bookingGroupsService.saveAddOns(state.bookingGroupId, payload)
        if (!response.success) throw new Error((response.data as any)?.message)

        set(draft => {
          draft.isLoading = false
          draft.currentStep = 'review-and-pay'
          draft.hasSubmitted = false
        })
        return true
      } catch (error: any) {
        set(draft => {
          draft.error = error?.message ?? 'Failed to save add-ons'
          draft.isLoading = false
        })
        return false
      }
    },

    setSpecialRequest: value => {
      set(state => {
        state.specialRequest = value
      })
    },

    createDraftBookingGroup: async () => {
      const state = get()

      // Reuse existing draft when user navigates back and forth between steps.
      // This prevents creating duplicate booking groups for the same flow.
      if (state.bookingGroupId) {
        if (!state.selectedSessionId || state.selectedChildIds.length === 0) return null

        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const response = await bookingGroupsService.updateDraft(state.bookingGroupId, {
            sessionId: state.selectedSessionId,
            childIds: state.selectedChildIds,
          })
          if (!response.success) throw new Error((response.data as any)?.message)

          set(draft => {
            draft.currentStep = 'addons'
            draft.addOnSelectionsById = normalizeAddOnSelectionsForSelectedChildren(
              draft.addOnSelectionsById,
              draft.selectedChildIds
            )
            draft.isLoading = false
            draft.error = null
          })
          return state.bookingGroupId
        } catch (error: any) {
          set(draft => {
            draft.error = error?.message ?? 'Failed to update draft booking group'
            draft.isLoading = false
          })
          return null
        }
      }

      if (!state.camp?.id || !state.selectedSessionId || state.selectedChildIds.length === 0) {
        return null
      }

      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        const response = await bookingGroupsService.createDraft({
          campId: state.camp.id,
          sessionId: state.selectedSessionId,
          childIds: state.selectedChildIds,
          // For reload restoration we only want to mark "review" after user reaches step-4.
          // Empty string should not be persisted in draft.
          specialRequest: state.specialRequest?.trim() ? state.specialRequest : undefined,
        })
        if (!response.success) throw new Error((response.data as any)?.message)

        set(draft => {
          draft.bookingGroupId = response.data.bookingGroupId
          draft.currentStep = 'addons'
          draft.addOnSelectionsById = {}
          draft.hasSubmitted = false
          draft.isLoading = false
        })
        return response.data.bookingGroupId
      } catch (error: any) {
        set(draft => {
          draft.error = error?.message ?? 'Failed to create draft booking group'
          draft.isLoading = false
        })
        return null
      }
    },

    submitBookingGroup: async () => {
      const state = get()
      if (!state.bookingGroupId) return false

      // Safety: persist add-ons + review marker even if user reached submit directly.
      try {
        const payload = buildSaveAddOnsPayload(state)
        await bookingGroupsService.saveAddOns(state.bookingGroupId, payload)
      } catch (_e) {
        // ignore here; submit endpoint will throw if it can't change status
      }

      set(draft => {
        draft.isLoading = true
        draft.error = null
      })
      try {
        const response = await bookingGroupsService.submit(state.bookingGroupId)
        if (!response.success) throw new Error((response.data as any)?.message)
        set(draft => {
          draft.isLoading = false
          draft.currentStep = 'review-and-pay'
          draft.hasSubmitted = true
        })
        return true
      } catch (error: any) {
        set(draft => {
          draft.error = error?.message ?? 'Failed to submit booking request'
          draft.isLoading = false
        })
        return false
      }
    },

    resetForNewBooking: () => {
      set(state => {
        state.currentStep = START_STEP
        state.bookingGroupId = null
        state.selectedSessionId = null
        state.selectedChildIds = []
        state.addOnSelectionsById = {}
        state.specialRequest = ''
        state.hasSubmitted = false
      })
    },
  }))
)

function inferAddOnMode(
  addOnConfig: CampBookingAddOn | undefined | null
): CampBookingAddOnSelectionMode {
  if (!addOnConfig) return 'per_child'

  // Heuristic mapping to match the reference behavior:
  // - checkbox per child: fixed 1/unit
  // - stepper per child: allows multiple quantity per child
  // - qty: global quantity for the add-on
  const maxQuantity = addOnConfig.maxQuantity ?? null
  const unit = addOnConfig.quantityUnit?.toLowerCase() ?? ''

  if (unit.includes('trip') || addOnConfig.pricingUnit === 'one_time') {
    return 'qty'
  }

  if (typeof maxQuantity === 'number' && maxQuantity > 1) {
    return 'per_child_qty'
  }

  return addOnConfig.pricingUnit === 'per_child' ? 'per_child' : 'per_child_qty'
}

function normalizeAddOnSelectionsForSelectedChildren(
  selections: Record<string, CampBookingAddOnSelection>,
  selectedChildIds: string[]
): Record<string, CampBookingAddOnSelection> {
  const selectedSet = new Set(selectedChildIds)
  const normalized: Record<string, CampBookingAddOnSelection> = {}

  for (const [addOnId, selection] of Object.entries(selections)) {
    if (!selection) continue

    if (selection.mode === 'per_child') {
      const childIds = (selection.childIds ?? []).filter(childId => selectedSet.has(childId))
      if (childIds.length === 0) continue
      normalized[addOnId] = { ...selection, childIds }
      continue
    }

    if (selection.mode === 'per_child_qty') {
      const childQuantities = (selection.childQuantities ?? []).filter(
        item => selectedSet.has(item.childId) && (item.quantity ?? 0) > 0
      )
      if (childQuantities.length === 0) continue
      normalized[addOnId] = { ...selection, childQuantities }
      continue
    }

    if ((selection.quantity ?? 0) <= 0) continue
    normalized[addOnId] = selection
  }

  return normalized
}

function buildSaveAddOnsPayload(state: {
  bookingGroupId: string | null
  addOns: CampBookingAddOn[]
  addOnSelectionsById: Record<string, CampBookingAddOnSelection>
  specialRequest: string
}): SaveBookingGroupAddOnsRequest {
  const addOns: CampBookingAddOnSelection[] = []

  for (const sel of Object.values(state.addOnSelectionsById)) {
    if (!sel) continue
    if (sel.mode === 'per_child') {
      if ((sel.childIds?.length ?? 0) === 0) continue
      addOns.push({
        addOnId: sel.addOnId,
        mode: sel.mode,
        childIds: sel.childIds,
      })
    } else if (sel.mode === 'per_child_qty') {
      const cleaned = (sel.childQuantities ?? []).filter(x => x.quantity > 0)
      if (cleaned.length === 0) continue
      addOns.push({
        addOnId: sel.addOnId,
        mode: sel.mode,
        childQuantities: cleaned,
      })
    } else {
      const q = sel.quantity ?? 0
      if (q <= 0) continue
      addOns.push({ addOnId: sel.addOnId, mode: sel.mode, quantity: q })
    }
  }

  return {
    addOns,
    // Persist even if empty string to enable reload restoration to "review-and-pay".
    specialRequest: state.specialRequest,
  }
}
