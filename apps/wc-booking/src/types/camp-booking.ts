import type { Child } from '@/types/child'
import type { Session } from '@/types/sessions'

export type BookingFlowStep = 'sessions' | 'children' | 'addons' | 'review-and-pay'

/**
 * Payment metadata returned by `POST /user/booking-groups/:id/submit` — the
 * Stripe.js confirmation method to call (`confirmPayment` for PaymentIntent,
 * `confirmSetup` for SetupIntent), the client secret, and the amount/currency
 * to display in confirmation copy.
 */
export type SubmitPaymentIntentType = 'payment_intent' | 'setup_intent'
export type SubmitPaymentKind = 'deposit' | 'full' | 'setup'

export interface SubmitPaymentResponse {
  intentType: SubmitPaymentIntentType
  kind: SubmitPaymentKind
  paymentId: string
  intentId: string
  clientSecret: string
  /// Major-unit string ("600.00").
  amount: string
  /// ISO 4217 lowercase ("eur").
  currency: string
}

export interface SubmitBookingGroupResponse {
  bookingGroupId: string
  status: string
  payment: SubmitPaymentResponse
}

/**
 * Add-on price is denominated in the camp's provider currency
 * (`camp.provider.settings.currency`). There is no per-add-on currency
 * field — consumers read currency from the camp context.
 */
export interface CampBookingAddOn {
  addOnId: string
  campId: string
  name: string
  description?: string | null
  icon?: string | null
  type: string
  price: number
  pricingUnit: string
  maxQuantity?: number | null
  quantityUnit?: string | null
  minAge?: number | null
  maxAge?: number | null
  sortOrder: number
}

export interface CreateDraftBookingGroupRequest {
  campId: string
  sessionId: string
  childIds: string[]
  specialRequest?: string
  /// Parent's legal-guardian confirmation for the selected children. Backend
  /// requires this to be true and stamps the consent timestamp on the group.
  guardianConsent: boolean
  forceNew?: boolean
}

export type CampBookingAddOnSelectionMode = 'per_child' | 'per_child_qty' | 'qty'

export interface CampBookingChildQuantity {
  childId: string
  quantity: number
}

export interface CampBookingAddOnSelection {
  addOnId: string
  mode: CampBookingAddOnSelectionMode
  // `qty` mode
  quantity?: number
  // `per_child` mode
  childIds?: string[]
  // `per_child_qty` mode
  childQuantities?: CampBookingChildQuantity[]
}

export interface SaveBookingGroupAddOnsRequest {
  addOns: CampBookingAddOnSelection[]
  // Used to persist the review step marker for reload restoration.
  // If omitted, we keep the current bookingGroup.specialRequest value.
  specialRequest?: string
}

export interface DraftBookingChild {
  id: string
  childId: string
  bookingNumber: string
}

export interface DraftBookingGroupResponse {
  bookingGroupId: string
  bookingGroupNumber: string
  status: string
  bookings: DraftBookingChild[]
}

/** GET /user/booking-groups/:id — parent detail (hydration + booking detail page). */
export interface ParentBookingGroupBookingLine {
  id: string
  bookingNumber: string
  childId: string
  basePrice: number
  discountAmount: number
  totalPrice: number
  addOns: { campId: string; addOnId: string; quantity: number }[]
  child: {
    id: string
    firstName: string
    dateOfBirth: string | null
    photoUrl: string | null
  }
}

export type SessionDayTypeApi = 'full_day' | 'half_day' | null

/**
 * Latest Payment summary surfaced on the booking detail. Used by the booking
 * flow to decide on reload whether the parent still needs to enter a card
 * (status not yet authorized) or the booking is fully ready (already
 * authorized, awaiting provider acceptance).
 */
export type ParentPaymentRowStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'succeeded'
  | 'canceled'
  | 'failed'

export interface ParentBookingPaymentSummary {
  id: string
  kind: 'deposit' | 'balance' | 'full' | 'rebill'
  status: ParentPaymentRowStatus
  intentType: 'payment_intent' | 'setup_intent'
}

export interface ParentBookingGroupDetail {
  id: string
  bookingGroupNumber: string
  status: ParentBookingGroupStatus
  campId: string
  sessionId: string
  providerId: string
  specialRequest?: string | null
  subtotalAmount: number
  discountTotal: number
  totalAmount: number
  depositAmount: number | null
  paidAmount: number
  refundedAmount: number
  /** ISO 4217 settlement currency for this booking — always the Provider's currency. */
  currency: string
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  payment: ParentBookingPaymentSummary | null
  camp: {
    id: string
    name: string
    slug: string
    coverImageUrl: string | null
    locationLat: number | null
    locationLng: number | null
    locationName: string | null
    locationAddress: string | null
    /** Google Maps place ID for the camp location / business (Places API). */
    locationPlaceId: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
    sessionDayType: SessionDayTypeApi
    arrivalTime: string | null
    departureTime: string | null
  }
  provider: {
    legalCompanyName: string | null
  }
  bookings: ParentBookingGroupBookingLine[]
}

/** @deprecated Use ParentBookingGroupDetail — alias kept for existing imports. */
export type BookingGroupDetails = ParentBookingGroupDetail

export interface DraftBookingPreview {
  id: string
  bookingGroupNumber: string
  sessionId: string
  sessionName?: string | null
  updatedAt: string
  totalAmount: number
  childrenCount: number
}

/** Parent dashboard list item — matches GET /user/booking-groups */
export type ParentBookingGroupStatus =
  | 'draft'
  | 'request'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'deposit_paid'
  | 'fully_paid'
  | 'at_camp'
  | 'completed'
  | 'cancelled'

export interface ParentBookingGroupSummaryChild {
  id: string
  firstName: string
  dateOfBirth: string | null
  photoUrl: string | null
}

export interface ParentBookingGroupSummary {
  id: string
  bookingGroupNumber: string
  status: ParentBookingGroupStatus
  totalAmount: number
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  camp: {
    id: string
    name: string
    slug: string
    coverImageUrl: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
  }
  children: ParentBookingGroupSummaryChild[]
}

export interface BookingStepChildrenState {
  selectedChildIds: string[]
  children: Child[]
}

export interface BookingStepSessionsState {
  sessions: Session[]
  selectedSessionId: string | null
}

/**
 * types for the parent cancel + refund-preview flow. Mirror of
 * `ParentCancelMode` and `RefundPreview` on the backend.
 */
export type ParentCancelMode = 'void_auth' | 'grace' | 'policy' | 'not_cancelable'

export interface ParentRefundPreviewItem {
  paymentId: string
  kind: string
  originalAmountMajor: string
  refundAmountMajor: string
}

export interface ParentRefundPreview {
  mode: ParentCancelMode
  currentStatus: ParentBookingGroupStatus
  reason?: string
  gracePeriodEndsAt?: string
  policy?: {
    policyName: string
    matchedTier: { daysBeforeStart: number; refundPercentage: number } | null
    daysBeforeStart: number
    evaluatedAt: string
    /**
     * Set when the parent's `circumstance` claim matched a provider-configured
     * special-circumstance refund AND the override was more generous than the
     * standard tier. The matchedTier above already reflects the override.
     */
    appliedCircumstance?: {
      type: 'medical' | 'force_majeure' | 'weather'
      refundPercentage: number
    } | null
  }
  items: ParentRefundPreviewItem[]
  totalRefundMajor: string
  currency: string | null
}
