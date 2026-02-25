// Discount Types for wc-provider app

export type DiscountType = 'percent' | 'fixed'

export enum DiscountCategory {
  EARLY_BIRD = 'early_bird',
  SIBLING = 'sibling',
  RETURNING_CAMPER = 'returning_camper',
  MULTI_WEEK = 'multi_week',
  GROUP_BOOKING = 'group_booking',
  PROMO_CODE = 'promo_code',
}

export enum CalculationType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// Discount Entry (part of GlobalDiscount.entries array)
export interface DiscountEntry {
  id: string
  name: string
  value?: number
  calculationType?: CalculationType
  validFrom?: string
  validUntil?: string
  details?: string
  config?: Record<string, any>
}

// Global Discount (camp-level)
export interface GlobalDiscount {
  id: string
  campId: string
  category: DiscountCategory
  isEnabled: boolean
  sortOrder: number
  entries: DiscountEntry[]
  createdAt: string
  updatedAt: string
}

// Session-Specific Discount
export interface SessionSpecificDiscount {
  id: string
  name: string
  type: DiscountType
  value: number
  validUntil?: string | null
  ageGroups: string[] // Empty = applies to all ages
}

// Session Discounts Structure (stored in session.discounts JSON field)
export interface SessionDiscounts {
  globalApplied: string[] // IDs of global discounts applied
  globalRemoved: string[] // IDs of global discounts removed
  sessionSpecific: SessionSpecificDiscount[]
}

// DTOs for API calls

export interface UpdateGlobalDiscountDto {
  entries?: DiscountEntry[]
  isEnabled?: boolean
  sortOrder?: number
}

export interface AddDiscountEntryDto {
  name: string
  value?: number
  calculationType?: CalculationType
  validFrom?: string
  validUntil?: string
  details?: string
  config?: Record<string, any>
}

export interface UpdateDiscountEntryDto {
  name?: string
  value?: number
  calculationType?: CalculationType
  validFrom?: string
  validUntil?: string
  details?: string
  config?: Record<string, any>
}

export interface AddSessionDiscountDto {
  name: string
  type: DiscountType
  value: number
  validUntil?: string | null
  ageGroups?: string[]
}

export interface RemoveGlobalDiscountDto {
  globalDiscountId: string
}

export interface ApplyGlobalDiscountDto {
  globalDiscountId: string
}

// API Response types
export interface GlobalDiscountsResponse {
  discounts: GlobalDiscount[]
}

export interface GlobalDiscountResponse {
  discount: GlobalDiscount
  message?: string
}
