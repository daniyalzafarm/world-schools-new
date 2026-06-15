import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { childrenService } from '@/services/children.services'
import { getCampBySlug, getCampReviews } from '@/services/camps.services'
import { campSessionsService } from '@/services/camp-sessions.services'
import { campAddOnsService } from '@/services/camp-addons.services'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { ChildBookingRange } from '@world-schools/wc-types'
import type { Camp } from '@/types/camps'
import type { Child } from '@/types/child'
import type { CampReviewsData } from '@/types/reviews'
import type { Session } from '@/types/sessions'
import type {
  BookingFlowStep,
  CampBookingAddOn,
  CampBookingAddOnSelection,
  CampBookingChildQuantity,
  DraftBookingPreview,
  SaveBookingGroupAddOnsRequest,
  SubmitPaymentResponse,
} from '@/types/camp-booking'
import { getAddOnMode } from '@/utils/addon-pricing'
import { getEligibleChildIds } from '@/utils/child-eligibility'

interface CampBookingState {
  campSlug: string | null
  camp: Camp | null
  campReviews: CampReviewsData | null
  sessions: Session[]
  children: Child[]
  /// The parent's children's capacity-consuming booking windows, used to grey
  /// out a child whose dates overlap the selected session (mirrors the backend
  /// `existing_booking_same_dates` gate). Best-effort: empty on fetch failure.
  childBookingRanges: ChildBookingRange[]
  addOns: CampBookingAddOn[]
  selectedSessionId: string | null
  selectedChildIds: string[]
  /// Legal-guardian confirmation captured on the Children step. Required before
  /// continuing; reset whenever the child selection changes so the parent must
  /// re-confirm if they change who is going.
  guardianConsent: boolean
  addOnSelectionsById: Record<string, CampBookingAddOnSelection>
  currentStep: BookingFlowStep
  bookingGroupId: string | null
  hasSubmitted: boolean
  isLoading: boolean
  error: string | null
  duplicateDraftConflict: { bookingGroupId: string; message: string } | null
  draftPreviews: DraftBookingPreview[]
  /// Set true once `confirmPayment` / `confirmSetup` resolves successfully.
  /// Distinct from `hasSubmitted` because some flows authorize at submit
  /// (PaymentIntent) and confirm asynchronously (3DS) — the button stays
  /// enabled until paymentConfirmed is true.
  paymentConfirmed: boolean
  /// Payments revamp (Spec v2.3): checkout consent captured from the review
  /// step's acknowledgement checkbox. Set BEFORE the Stripe flow starts (on the
  /// checkbox toggle) so `submitBookingGroup` only READS it — it must never
  /// mutate the store inside the elements.submit()→confirmPayment window.
  consent: { consentAcknowledged: boolean; policyTextShown: string } | null
}

interface CampBookingActions {
  initByCampSlug: (campSlug: string) => Promise<void>
  hydrateFromBookingGroupId: (bookingGroupId: string) => Promise<void>
  setStep: (step: BookingFlowStep) => void
  selectSession: (sessionId: string | null) => void
  toggleChild: (childId: string) => void
  setGuardianConsent: (value: boolean) => void
  autoSelectEligibleChildren: () => void
  addChild: (child: {
    firstName: string
    lastName?: string
    dateOfBirth: string
    gender: 'boy' | 'girl'
  }) => Promise<Child | null>
  createDraftBookingGroup: (options?: {
    forceNew?: boolean
  }) => Promise<{ bookingGroupId: string | null; duplicateDraftId?: string }>
  clearDuplicateDraftConflict: () => void
  toggleAddOn: (addOnId: string) => void
  toggleAddOnChild: (addOnId: string, childId: string) => void
  setAddOnChildQuantity: (addOnId: string, childId: string, quantity: number) => void
  setAddOnQuantity: (addOnId: string, quantity: number) => void
  saveAddOnsAndGoToReview: () => Promise<boolean>
  /**
   * Posts the booking to the server and returns the Stripe payment metadata
   * (intentType + clientSecret) for the calling component to confirm. Throws
   * on server error so the caller can surface the message inline. Returns
   * `null` only when no bookingGroupId is set (fail-safe).
   *
   * IMPORTANT: this fn deliberately performs no store mutations — see the
   * Stripe.js race window note in the implementation.
   */
  submitBookingGroup: () => Promise<SubmitPaymentResponse | null>
  /**
   * Marks the payment as confirmed after Stripe.js's `confirmPayment` /
   * `confirmSetup` resolves. Sets `hasSubmitted` so the review screen swaps
   * to the success panel.
   */
  markPaymentConfirmed: () => void
  setSpecialRequest: (value: string) => void
  setConsent: (consent: { consentAcknowledged: boolean; policyTextShown: string } | null) => void
  resetForNewBooking: () => void
  specialRequest: string
}

type CampBookingStore = CampBookingState & CampBookingActions

const START_STEP: BookingFlowStep = 'sessions'

export const useCampBookingStore = create<CampBookingStore>()(
  immer((set, get) => ({
    campSlug: null,
    camp: null,
    campReviews: null,
    sessions: [],
    children: [],
    childBookingRanges: [],
    addOns: [],
    selectedSessionId: null,
    selectedChildIds: [],
    guardianConsent: false,
    addOnSelectionsById: {},
    currentStep: START_STEP,
    bookingGroupId: null,
    hasSubmitted: false,
    isLoading: false,
    error: null,
    duplicateDraftConflict: null,
    draftPreviews: [],
    specialRequest: '',
    paymentConfirmed: false,
    consent: null,

    setConsent: consent => {
      set(state => {
        state.consent = consent
      })
    },

    initByCampSlug: async campSlug => {
      set(state => {
        state.isLoading = true
        state.error = null
        state.campSlug = campSlug
      })

      try {
        const camp = await getCampBySlug(campSlug)
        // Connect onboarding gate: under Direct Charges the provider's `acct_…`
        // is bound to the Stripe.js instance via `loadStripe(pk, { stripeAccount })`
        // and the PaymentIntent is created on the connected account directly.
        // Refuse to start the booking flow at all when the account id is missing,
        // instead of failing later at submit with a Stripe scoping error.
        if (!camp.provider?.stripeAccountId) {
          throw new Error(
            'This provider isn’t fully set up for payments yet. Please contact support.'
          )
        }
        // Settlement currency comes from the provider's onboarding settings and
        // drives every price in the flow (and the Stripe charge currency). Refuse
        // to start booking a provider that finished payment setup but has no
        // currency configured, rather than guessing one downstream.
        if (!camp.provider?.settings?.currency) {
          throw new Error('This provider isn’t fully set up yet. Please contact support.')
        }
        const [sessionsResponse, childrenResponse, addOnsResponse, campReviews, bookingRanges] =
          await Promise.all([
            campSessionsService.getByCampId(camp.id),
            childrenService.getAll(),
            campAddOnsService.getByCampId(camp.id),
            // Reviews are non-critical for the flow (camp page swallows the same
            // failure); a 404/500 here must not break booking. Fall back to null
            // and the sidebar shows the "0 reviews" empty state.
            getCampReviews(camp.id).catch(() => null),
            // Existing-booking date windows for the overlap guardrail. Non-critical:
            // on failure we degrade to backend-only enforcement (submit still gates),
            // so swallow errors and fall back to an empty list.
            bookingGroupsService
              .getChildBookingRanges()
              .then(res => (res.success ? res.data : []))
              .catch(() => []),
          ])

        if (!sessionsResponse.success) throw new Error((sessionsResponse.data as any)?.message)
        if (!childrenResponse.success) throw new Error((childrenResponse.data as any)?.message)
        if (!addOnsResponse.success) throw new Error((addOnsResponse.data as any)?.message)

        set(state => {
          state.camp = camp
          state.campReviews = campReviews
          state.sessions = sessionsResponse.data
          state.children = childrenResponse.data
          state.childBookingRanges = bookingRanges
          state.addOns = addOnsResponse.data
          state.currentStep = START_STEP
          state.bookingGroupId = null
          state.duplicateDraftConflict = null
          state.draftPreviews = []
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
        // Best-effort sync first: if the parent reloaded the page mid-flow
        // (e.g. after `stripe.confirmPayment` redirected for 3DS, or the tab
        // closed before the success path's sync call), this pulls the live
        // intent state from Stripe so the next getById returns a fresh
        // Payment summary. Errors are swallowed — the load proceeds with
        // whatever DB state exists, which the webhook will reconcile later.
        try {
          await bookingGroupsService.syncPayment(bookingGroupId)
        } catch (_syncErr) {
          /* swallow — getById will still return useful state */
        }

        const response = await bookingGroupsService.getById(bookingGroupId)
        if (!response.success) throw new Error((response.data as any)?.message)
        const details = response.data
        const selectedChildIds = details.bookings.map(item => item.childId)

        // Detect "already authorized" so we render the success panel
        // (instead of asking the parent to re-enter their card) when they
        // reload after a successful confirm. For SetupIntent placeholders
        // the Payment row's `status` stays at `processing` after a
        // successful confirmSetup (the placeholder is a cron-driven row),
        // so we don't infer anything from it for setup_intent yet — the
        // parent would simply see the form and Stripe would resolve the
        // duplicate confirm gracefully. Phase 3 hardens this case.
        const isPaymentAlreadyAuthorized =
          details.payment?.intentType === 'payment_intent' &&
          (details.payment.status === 'requires_capture' || details.payment.status === 'succeeded')

        set(state => {
          state.bookingGroupId = details.id
          state.selectedSessionId = details.sessionId
          state.selectedChildIds = selectedChildIds
          state.specialRequest = details.specialRequest ?? ''
          state.hasSubmitted = details.status !== 'draft'
          state.paymentConfirmed = isPaymentAlreadyAuthorized

          const hasReviewMarker =
            details.specialRequest !== null && details.specialRequest !== undefined
          const hasAnySavedAddOns = details.bookings.some(b => (b.addOns?.length ?? 0) > 0)

          if (details.status !== 'draft' || hasReviewMarker) {
            state.currentStep = 'review-and-pay'
          } else if (selectedChildIds.length > 0) {
            state.currentStep = state.addOns.length > 0 ? 'addons' : 'review-and-pay'
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
                if (booking.childId === firstBooking?.childId) {
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
          state.duplicateDraftConflict = null
          state.draftPreviews = []
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

    clearDuplicateDraftConflict: () => {
      set(state => {
        state.duplicateDraftConflict = null
        state.draftPreviews = []
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
        // Changing who is going invalidates a prior guardian confirmation —
        // force the parent to re-confirm for the new set of children.
        state.guardianConsent = false
      })
    },

    setGuardianConsent: value => {
      set(state => {
        state.guardianConsent = value
      })
    },

    autoSelectEligibleChildren: () => {
      set(state => {
        // Respect any existing selection (e.g. from hydrated drafts or prior user input).
        if (state.selectedChildIds.length > 0) return
        const session = state.sessions.find(s => s.id === state.selectedSessionId)
        const maxSpots = session?.totalSpots ?? null
        // Only auto-select children that actually pass the eligibility gate
        // (camp age groups + gender + readiness) — the same check the step-2 UI
        // shows. A simple age range would pre-select children the camp rejects.
        const eligibleIds = getEligibleChildIds(
          state.camp,
          session,
          state.children,
          state.childBookingRanges
        )
        state.selectedChildIds = maxSpots !== null ? eligibleIds.slice(0, maxSpots) : eligibleIds
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

    createDraftBookingGroup: async options => {
      const state = get()

      // Pre-flight eligibility re-validation against the authoritative server
      // rules — catches skill-GATE failures the client can't evaluate on its
      // own, so the parent sees the reason here instead of a late error at the
      // payment step. Advisory only: on a network/non-success response we let
      // the flow continue (the submit gate still enforces).
      if (state.camp?.id && state.selectedSessionId && state.selectedChildIds.length > 0) {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })
        try {
          const eligibility = await bookingGroupsService.checkEligibility({
            campId: state.camp.id,
            sessionId: state.selectedSessionId,
            childIds: state.selectedChildIds,
          })
          if (eligibility.success) {
            const ineligible = (eligibility.data?.results ?? []).filter(r => !r.eligible)
            if (ineligible.length > 0) {
              const reason =
                ineligible[0]?.failures?.[0]?.message ??
                "A selected child does not meet this camp's requirements."
              set(draft => {
                draft.error = reason
                draft.isLoading = false
              })
              return { bookingGroupId: null }
            }
          }
        } catch {
          // Advisory check failed — proceed; the submit gate is authoritative.
        }
      }

      // Reuse existing draft when user navigates back and forth between steps.
      // This prevents creating duplicate booking groups for the same flow.
      if (state.bookingGroupId) {
        if (!state.selectedSessionId || state.selectedChildIds.length === 0) {
          return { bookingGroupId: null }
        }

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
            draft.currentStep = draft.addOns.length > 0 ? 'addons' : 'review-and-pay'
            draft.addOnSelectionsById = normalizeAddOnSelectionsForSelectedChildren(
              draft.addOnSelectionsById,
              draft.selectedChildIds
            )
            draft.isLoading = false
            draft.error = null
            draft.duplicateDraftConflict = null
            draft.draftPreviews = []
          })
          return { bookingGroupId: state.bookingGroupId }
        } catch (error: any) {
          set(draft => {
            draft.error = error?.message ?? 'Failed to update draft booking group'
            draft.isLoading = false
          })
          return { bookingGroupId: null }
        }
      }

      if (!state.camp?.id || !state.selectedSessionId || state.selectedChildIds.length === 0) {
        return { bookingGroupId: null }
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
          guardianConsent: state.guardianConsent,
          forceNew: options?.forceNew === true,
          // For reload restoration we only want to mark "review" after user reaches step-4.
          // Empty string should not be persisted in draft.
          specialRequest: state.specialRequest?.trim() ? state.specialRequest : undefined,
        })

        if (!response.success) {
          const payload = response.data as any
          const isDuplicateDraftConflict =
            Number(payload?.statusCode) === 409 &&
            typeof payload?.message === 'string' &&
            payload.message.toLowerCase().includes('draft booking')

          if (isDuplicateDraftConflict) {
            const message =
              payload?.message ??
              'You already have a draft booking for this camp. Continue your existing booking or create a new one.'
            const previewsResponse = await bookingGroupsService.getLatestDraftPreviews(
              state.camp.id
            )
            const draftPreviews = previewsResponse.success ? previewsResponse.data : []
            const selectedDraftId = draftPreviews[0]?.id ?? ''
            set(draft => {
              // Duplicate draft is handled by the confirmation modal, not the page-level error banner.
              draft.error = null
              draft.duplicateDraftConflict = {
                bookingGroupId: selectedDraftId,
                message,
              }
              draft.draftPreviews = draftPreviews
              draft.isLoading = false
            })
            return {
              bookingGroupId: null,
              duplicateDraftId: selectedDraftId || undefined,
            }
          }
          throw new Error(payload?.message ?? 'Failed to create draft booking group')
        }

        set(draft => {
          draft.bookingGroupId = response.data.bookingGroupId
          draft.currentStep = draft.addOns.length > 0 ? 'addons' : 'review-and-pay'
          draft.addOnSelectionsById = {}
          draft.hasSubmitted = false
          draft.isLoading = false
          draft.error = null
          draft.duplicateDraftConflict = null
          draft.draftPreviews = []
        })
        return { bookingGroupId: response.data.bookingGroupId }
      } catch (error: any) {
        set(draft => {
          draft.error = error?.message ?? 'Failed to create draft booking group'
          draft.isLoading = false
        })
        return { bookingGroupId: null }
      }
    },

    submitBookingGroup: async () => {
      // CRITICAL: this fn must NOT mutate the store between the caller's
      // `elements.submit()` and `stripe.confirmPayment` calls. Any store write
      // here would trigger React re-renders during the Stripe flow window and
      // can cause Stripe.js to drop the form data queued by `elements.submit`.
      // Server-side `submitForParent` is idempotent — it returns the same
      // intent + a fresh `clientSecret` when called repeatedly while a Payment
      // is in-flight — so retries are safe without any client-side cache.
      const state = get()
      if (!state.bookingGroupId) return null

      try {
        const payload = buildSaveAddOnsPayload(state)
        await bookingGroupsService.saveAddOns(state.bookingGroupId, payload)
      } catch (_e) {
        // ignore: submit endpoint will throw if it can't change status
      }

      // Consent was captured on the checkbox toggle (before this Stripe-flow
      // window opened), so we only READ it here — no store mutation. Optional on
      // the resume path; the server enforces it on the initial draft→request.
      const response = await bookingGroupsService.submit(
        state.bookingGroupId,
        state.consent
          ? {
              consentAcknowledged: state.consent.consentAcknowledged,
              policyTextShown: state.consent.policyTextShown,
              schemaVersion: 1,
            }
          : undefined
      )
      if (!response.success) {
        throw new Error((response.data as any)?.message ?? 'Failed to submit booking request')
      }
      return response.data.payment
    },

    markPaymentConfirmed: () => {
      set(draft => {
        draft.paymentConfirmed = true
        draft.hasSubmitted = true
      })
    },

    resetForNewBooking: () => {
      set(state => {
        state.currentStep = START_STEP
        state.bookingGroupId = null
        state.duplicateDraftConflict = null
        state.draftPreviews = []
        state.selectedSessionId = null
        state.selectedChildIds = []
        state.guardianConsent = false
        state.addOnSelectionsById = {}
        state.specialRequest = ''
        state.hasSubmitted = false
        state.paymentConfirmed = false
        state.consent = null
      })
    },
  }))
)

const inferAddOnMode = (addOnConfig: CampBookingAddOn | undefined | null) =>
  addOnConfig ? getAddOnMode(addOnConfig) : 'per_child'

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
