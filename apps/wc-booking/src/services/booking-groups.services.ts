import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  ChildBookingRange,
  EligibilityResult,
  ParentBookingGroupsQuery,
  SpecialCircumstanceType,
} from '@world-schools/wc-types'
import type {
  CreateDraftBookingGroupRequest,
  DraftBookingGroupResponse,
  DraftBookingPreview,
  ParentBookingGroupDetail,
  ParentBookingGroupSummary,
  ParentCancelMode,
  ParentRefundPreview,
  SaveBookingGroupAddOnsRequest,
  SubmitBookingGroupResponse,
} from '@/types/camp-booking'

export const bookingGroupsService = {
  async list(params?: ParentBookingGroupsQuery): Promise<ApiResult<ParentBookingGroupSummary[]>> {
    const sp = new URLSearchParams()
    if (params?.tab) sp.set('tab', params.tab)
    if (params?.status) sp.set('status', params.status)
    if (params?.sortBy) sp.set('sortBy', params.sortBy)
    if (params?.sortOrder) sp.set('sortOrder', params.sortOrder)
    if (params?.page != null) sp.set('page', String(params.page))
    if (params?.limit != null) sp.set('limit', String(params.limit))
    const q = sp.toString()
    return apiClient.get<ParentBookingGroupSummary[]>(
      q ? `/user/booking-groups?${q}` : '/user/booking-groups'
    )
  },

  async createDraft(
    payload: CreateDraftBookingGroupRequest
  ): Promise<ApiResult<DraftBookingGroupResponse>> {
    return apiClient.post<DraftBookingGroupResponse>('/user/booking-groups/draft', payload)
  },

  async getById(bookingGroupId: string): Promise<ApiResult<ParentBookingGroupDetail>> {
    return apiClient.get<ParentBookingGroupDetail>(`/user/booking-groups/${bookingGroupId}`)
  },

  /**
   * The parent's primary (most recent non-draft) booking with a camp, or `null`
   * when none exists. Powers the messaging context panel in a single call.
   */
  async getByCamp(campId: string): Promise<ApiResult<ParentBookingGroupDetail | null>> {
    return apiClient.get<ParentBookingGroupDetail | null>(
      `/user/booking-groups/by-camp/${encodeURIComponent(campId)}`
    )
  },

  /**
   * Non-mutating pre-validation: evaluates the selected children against a
   * camp/session (age, gender, GATE skills, readiness). Mirrors the
   * authoritative gate run at submit so the UI can block / explain BEFORE the
   * payment step — in particular it surfaces skill-gate failures the client
   * cannot evaluate on its own.
   */
  async checkEligibility(payload: {
    campId: string
    sessionId: string
    childIds: string[]
  }): Promise<ApiResult<{ results: EligibilityResult[] }>> {
    return apiClient.post<{ results: EligibilityResult[] }>(
      '/user/booking-groups/eligibility-check',
      payload
    )
  },

  /**
   * Date windows of the parent's children's capacity-consuming bookings. Used to
   * grey out a child whose dates overlap the selected session up front — the
   * client mirror of the authoritative `existing_booking_same_dates` gate.
   */
  async getChildBookingRanges(): Promise<ApiResult<ChildBookingRange[]>> {
    return apiClient.get<ChildBookingRange[]>('/user/booking-groups/child-booking-ranges')
  },

  async getLatestDraftPreviews(campId: string): Promise<ApiResult<DraftBookingPreview[]>> {
    return apiClient.get<DraftBookingPreview[]>(
      `/user/booking-groups/draft-previews/latest?campId=${encodeURIComponent(campId)}`
    )
  },

  async updateDraft(
    bookingGroupId: string,
    payload: { sessionId: string; childIds: string[] }
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/user/booking-groups/${bookingGroupId}/draft`,
      payload
    )
  },

  /**
   * Submits a draft booking. Server creates the Stripe PaymentIntent (or
   * SetupIntent) atomically with the status transition, returning the
   * client secret + payment metadata so Elements can confirm the card.
   *
   * Payments revamp (Spec v2.3): carries the checkout consent acknowledgement.
   * The server REJECTS the initial draft→request submit unless
   * `consentAcknowledged === true`, and persists a consent snapshot (with the
   * IP / user-agent captured server-side). Consent is optional on the
   * idempotent resume path (re-submitting an already-`request` booking).
   */
  async submit(
    bookingGroupId: string,
    consent?: { consentAcknowledged: boolean; policyTextShown?: string; schemaVersion?: number }
  ): Promise<ApiResult<SubmitBookingGroupResponse>> {
    return apiClient.post<SubmitBookingGroupResponse>(
      `/user/booking-groups/${bookingGroupId}/submit`,
      consent ?? {}
    )
  },

  /**
   * Tells the server to retrieve the live PaymentIntent / SetupIntent state
   * from Stripe and reconcile the local Payment row. Called by the frontend
   * right after `stripe.confirmPayment` resolves so we don't need to wait
   * for Stripe's webhook to arrive (especially useful in dev where
   * `stripe listen` may not be forwarding events). Idempotent — safe to
   * call multiple times.
   */
  async syncPayment(
    bookingGroupId: string
  ): Promise<ApiResult<{ bookingGroupId: string; synced: boolean }>> {
    return apiClient.post<{ bookingGroupId: string; synced: boolean }>(
      `/user/booking-groups/${bookingGroupId}/sync-payment`,
      {}
    )
  },

  async saveAddOns(
    bookingGroupId: string,
    payload: SaveBookingGroupAddOnsRequest
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/user/booking-groups/${bookingGroupId}/addons`,
      payload
    )
  },

  async deleteDraft(
    bookingGroupId: string
  ): Promise<ApiResult<{ bookingGroupId: string; deleted: boolean }>> {
    return apiClient.del<{ bookingGroupId: string; deleted: boolean }>(
      `/user/booking-groups/${bookingGroupId}`
    )
  },

  /**
   * Phase 4: read-only refund preview for the cancel modal. The parent
   * sees the exact amount they'd get back BEFORE confirming. The mode tells
   * the modal which copy to render (full grace refund vs. policy partial vs.
   * void-auth pre-capture vs. not-cancelable).
   */
  async refundPreview(
    bookingGroupId: string,
    options: { circumstance?: SpecialCircumstanceType | null } = {}
  ): Promise<ApiResult<ParentRefundPreview>> {
    const sp = new URLSearchParams()
    if (options.circumstance) sp.set('circumstance', options.circumstance)
    const q = sp.toString()
    return apiClient.get<ParentRefundPreview>(
      q
        ? `/user/booking-groups/${bookingGroupId}/refund-preview?${q}`
        : `/user/booking-groups/${bookingGroupId}/refund-preview`
    )
  },

  /**
   * Phase 4: parent-initiated cancellation. Server dispatches based on the
   * live booking state — pre-capture voids the auth, in-grace issues 100%,
   * post-grace issues the policy-tier % refund. Optional `circumstance` opts
   * into a provider-configured special-circumstance refund (medical /
   * force_majeure / weather) — server applies the override only when it
   * exceeds the standard tier.
   */
  async cancel(
    bookingGroupId: string,
    options: { circumstance?: SpecialCircumstanceType | null } = {}
  ): Promise<ApiResult<{ bookingGroupId: string; mode: ParentCancelMode; refundCount: number }>> {
    const body: { circumstance?: SpecialCircumstanceType } = {}
    if (options.circumstance) body.circumstance = options.circumstance
    return apiClient.post<{
      bookingGroupId: string
      mode: ParentCancelMode
      refundCount: number
    }>(`/user/booking-groups/${bookingGroupId}/cancel`, body)
  },
}
