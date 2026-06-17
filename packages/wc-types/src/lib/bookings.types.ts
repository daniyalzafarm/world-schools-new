export type BookingGroupStatus =
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
  // Billing-driven terminal/edge statuses (mirror the Prisma enum so the
  // shared state machine and status maps stay exhaustive).
  | 'payment_failed'
  | 'partially_refunded'
  | 'fully_refunded'
  | 'disputed'

/**
 * Provider Terms v1.5 §5.1(h)(iii) controlled list of decline reasons.
 * Mirrored from the Prisma `BookingDeclineReason` enum so the frontend can
 * render the dropdown without depending on the backend types package.
 *
 * NOTE: this is the canonical home for the decline-reason domain type. It was
 * previously defined in `websocket.types.ts`; consumers import it from the
 * `@world-schools/wc-types` package root, so the move is transparent.
 */
export enum BookingDeclineReason {
  CapacityOrScheduling = 'capacity_or_scheduling',
  EligibilityCriteriaNotMet = 'eligibility_criteria_not_met',
  OperationalInability = 'operational_inability',
  IncompleteInformation = 'incomplete_information',
  SafeguardingConcerns = 'safeguarding_concerns',
  Other = 'other',
}

/// Parent-facing labels for the decline-reason dropdown and notification
/// copy. Keep wording aligned with Provider Terms so legal review stays
/// straightforward.
export const BOOKING_DECLINE_REASON_LABELS: Record<BookingDeclineReason, string> = {
  [BookingDeclineReason.CapacityOrScheduling]: 'Session no longer available',
  [BookingDeclineReason.EligibilityCriteriaNotMet]: 'Enrollment requirements not met',
  [BookingDeclineReason.OperationalInability]: 'Unable to accommodate specific needs',
  [BookingDeclineReason.IncompleteInformation]: 'Incomplete or missing information',
  [BookingDeclineReason.SafeguardingConcerns]: 'Safety or safeguarding concern',
  [BookingDeclineReason.Other]: 'Other',
}

/// Decline reasons whose free-text note is mandatory — every reason except
/// `capacity_or_scheduling`. `operational_inability` is required by Provider
/// Terms §5.1(h)(iia)(D) ("…shall include a brief description of the specific
/// operational limitation relied upon"); the rest are required by platform
/// policy so the decline can be reviewed under §5.1(h)(iv) pattern monitoring.
/// Shared by the provider modal (client gate) and the API (server enforcement)
/// so the rule cannot drift.
export const DECLINE_REASONS_REQUIRING_NOTE: readonly BookingDeclineReason[] = [
  BookingDeclineReason.EligibilityCriteriaNotMet,
  BookingDeclineReason.OperationalInability,
  BookingDeclineReason.IncompleteInformation,
  BookingDeclineReason.SafeguardingConcerns,
  BookingDeclineReason.Other,
]

export const DECLINE_REASON_NOTE_MIN_LENGTH = 10
export const DECLINE_REASON_NOTE_MAX_LENGTH = 1000

/**
 * Reasons a child can fail the camp eligibility gate at booking time. Returned
 * by the shared `validateChildAgainstCamp` engine (wc-utils) and surfaced both
 * as a structured API error (parent) and as drawer badges (provider).
 */
export type EligibilityFailureCode =
  | 'age_out_of_range'
  | 'gender_mismatch'
  | 'skill_gate_not_met'
  | 'dob_missing'
  | 'no_emergency_contact'
  | 'medical_required'
  // The child already holds a capacity-consuming booking whose dates overlap
  // the selected session (a child can't be in two camps at once).
  | 'existing_booking_same_dates'

export interface EligibilityFailure {
  code: EligibilityFailureCode
  /// Human-readable, parent-safe explanation.
  message: string
  /// Skill-gate context (code === 'skill_gate_not_met').
  activityId?: string
  activityName?: string
  requiredLevel?: string
  childLevel?: string | null
  /// Age context (code === 'age_out_of_range').
  childAge?: number | null
  /// Gender context (code === 'gender_mismatch').
  requiredGender?: string
}

export interface EligibilityResult {
  childId: string
  eligible: boolean
  failures: EligibilityFailure[]
}

/**
 * A child's existing booking date window, returned by
 * `GET /user/booking-groups/child-booking-ranges`. The booking flow uses these
 * to grey out a child whose dates overlap the selected session (mirrors the
 * authoritative `existing_booking_same_dates` eligibility gate client-side).
 */
export interface ChildBookingRange {
  childId: string
  startDate: string
  endDate: string
}

export interface CreateDraftBookingGroupDto {
  campId: string
  sessionId: string
  childIds: string[]
  specialRequest?: string
}

export interface DraftBookingGroupResponse {
  bookingGroupId: string
  bookingGroupNumber: string
  status: BookingGroupStatus
  bookings: {
    id: string
    childId: string
    bookingNumber: string
  }[]
}

export type SessionDayTypeApi = 'full_day' | 'half_day' | null

/** Lifecycle tabs for GET /provider/booking-groups — match `tab` query param */
export const PROVIDER_BOOKING_TABS = [
  'all',
  'requests',
  'upcoming',
  'at-camp',
  'past',
  'expired',
  'declined',
  'cancelled',
] as const

export type ProviderBookingTab = (typeof PROVIDER_BOOKING_TABS)[number]

/**
 * Status values available for the status sub-filter dropdown under each lifecycle
 * tab. NOTE: the `all` tab's actual query is "every non-draft booking" (a superset
 * of the statuses listed here) — edge billing states (payment_failed,
 * partially_refunded, fully_refunded, disputed) show in the All list but are not
 * individually selectable in the status sub-filter.
 */
export const PROVIDER_TAB_STATUS_FILTER: Record<ProviderBookingTab, BookingGroupStatus[]> = {
  all: [
    'request',
    'accepted',
    'deposit_paid',
    'fully_paid',
    'at_camp',
    'completed',
    'expired',
    'declined',
    'cancelled',
  ],
  requests: ['request'],
  upcoming: ['accepted', 'deposit_paid', 'fully_paid'],
  'at-camp': ['at_camp'],
  past: ['completed'],
  expired: ['expired'],
  declined: ['declined'],
  cancelled: ['cancelled'],
}

/** Sort fields for GET /provider/booking-groups — match `sortBy` query param */
export type ProviderBookingSortField =
  | 'updatedAt'
  | 'requestedAt'
  | 'totalAmount'
  | 'sessionStart'
  | 'status'
  | 'bookingGroupNumber'
  | 'parentFirstName'
  | 'sessionName'

/** Query params for GET /provider/booking-groups */
export interface ProviderBookingGroupsQuery {
  tab?: ProviderBookingTab
  search?: string
  /** Narrow to one status within the current tab group */
  status?: BookingGroupStatus
  sortBy?: ProviderBookingSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/** Pagination + tab counts in GET /provider/booking-groups `meta` */
export interface ProviderBookingGroupsListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  tabCounts: {
    all: number
    requests: number
    upcoming: number
    atCamp: number
    past: number
    expired: number
    declined: number
    cancelled: number
  }
}

/** Lifecycle tabs for GET /user/booking-groups (parent side) */
export const PARENT_BOOKING_TABS = ['drafts', 'upcoming', 'past', 'cancelled'] as const

export type ParentBookingTab = (typeof PARENT_BOOKING_TABS)[number]

/** Status values available under each parent lifecycle tab */
export const PARENT_TAB_STATUS_FILTER: Record<ParentBookingTab, BookingGroupStatus[]> = {
  drafts: ['draft'],
  upcoming: ['request', 'accepted', 'deposit_paid', 'fully_paid', 'at_camp', 'expired', 'declined'],
  past: ['completed'],
  cancelled: ['cancelled'],
}

/** Sort fields for GET /user/booking-groups */
export const PARENT_BOOKING_SORT_FIELDS = [
  'updatedAt',
  'requestedAt',
  'totalAmount',
  'sessionStart',
] as const

export type ParentBookingSortField = (typeof PARENT_BOOKING_SORT_FIELDS)[number]

/** Query params for GET /user/booking-groups */
export interface ParentBookingGroupsQuery {
  tab?: ParentBookingTab
  /** Narrow to one status within the current tab group */
  status?: BookingGroupStatus
  /** Filter to booking groups that include this child */
  childId?: string
  sortBy?: ParentBookingSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/** Pagination + tab counts in GET /user/booking-groups `meta` */
export interface ParentBookingGroupsListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  tabCounts: Record<ParentBookingTab, number>
}

/** GET /provider/booking-groups — provider dashboard list row */
export interface ProviderBookingGroupSummary {
  id: string
  bookingGroupNumber: string
  status: BookingGroupStatus
  totalAmount: number
  paidAmount: number
  depositAmount: number
  refundedAmount: number
  currency: string
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  parent: {
    displayName: string
    email: string
    phone: string | null
  }
  camp: {
    name: string
    slug: string
    coverImageUrl: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
  }
  children: {
    id: string
    firstName: string
    dateOfBirth: string | null
    photoUrl: string | null
  }[]
  /**
   * Eligibility summary for the list column: true when every child passed the
   * gate at submit, false if any failed, null for legacy bookings (no snapshot).
   */
  eligibilityAllMet?: boolean | null
}

export interface ProviderBookingGroupBookingLine {
  id: string
  bookingNumber: string
  childId: string
  basePrice: number
  discountAmount: number
  totalPrice: number
  providerNote: string | null
  respondedAt: string | null
  addOns: {
    campId: string
    addOnId: string
    quantity: number
    name: string
    unitPrice: number
    lineTotal: number
  }[]
  child: {
    id: string
    firstName: string
    lastName: string | null
    nickname: string | null
    dateOfBirth: string | null
    photoUrl: string | null
    gender: string | null
    languages: string[]
    schoolYear: string | null
    schoolCountry: string | null
    medicalInfo: unknown | null
    emergencyContacts: unknown
    campPreferences: unknown | null
    interestLabels: string[]
  }
}

/** GET /provider/booking-groups/:id — provider detail (drawer) */
/**
 * A single derived capture in a booking's payment schedule (Payments revamp,
 * Spec v2.3). Sequence 0 is the deposit; 1..n are balance increments at their
 * refund-tier boundaries. `effectiveCaptureDate` is the acceptance-guarded date
 * the charge actually fires at (`max(captureDate, graceDeadline, acceptanceTime)`).
 */
export interface ScheduledCaptureView {
  sequence: number
  amount: number
  currency: string
  captureDate: string
  effectiveCaptureDate: string
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled'
}

export interface ProviderBookingGroupDetail {
  id: string
  bookingGroupNumber: string
  status: BookingGroupStatus
  currency: string
  campId: string
  sessionId: string
  providerId: string
  specialRequest?: string | null
  internalNotes: string | null
  subtotalAmount: number
  discountTotal: number
  totalAmount: number
  depositAmount: number | null
  paidAmount: number
  refundedAmount: number
  /** Read-only derived capture schedule (deposit + balance increments). */
  scheduledCaptures: ScheduledCaptureView[]
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  discountDetails: unknown | null
  /**
   * Per-child eligibility results captured at submit — the gate every non-draft
   * booking passed. Drives the request-drawer eligibility badge. Null for
   * legacy bookings submitted before the eligibility gate shipped.
   */
  eligibilityCheck?: { checkedAt: string; results: EligibilityResult[] } | null
  parent: {
    id: string
    userId: string
    displayName: string
    firstName: string | null
    lastName: string | null
    email: string
    phone: string | null
    phoneVerified: boolean
    profilePhotoUrl: string | null
    bio: string | null
    address: string | null
    languages: string[]
    primaryNationality: string | null
    secondaryNationality: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    country: string | null
    emailVerified: boolean
  }
  parentStats: {
    completedBookingGroupsCount: number
    /** When set, shown as the first About row (e.g. “4.7 rating from 13 reviews”). */
    averageRating?: number | null
    reviewsCount?: number | null
  }
  camp: {
    id: string
    name: string
    slug: string
    coverImageUrl: string | null
    locationLat: number | null
    locationLng: number | null
    locationName: string | null
    locationAddress: string | null
    locationPlaceId: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
    sessionDayType: SessionDayTypeApi
    arrivalTime: string | null
    departureTime: string | null
    durationWeeks: number | null
    spotsRemaining: number | null
    ageRangeLabel: string | null
  }
  provider: {
    legalCompanyName: string | null
  }
  messaging: {
    parentUserId: string
    conversationId: string | null
  }
  bookings: ProviderBookingGroupBookingLine[]
}
