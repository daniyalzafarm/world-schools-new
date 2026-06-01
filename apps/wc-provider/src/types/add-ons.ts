import { formatCurrency } from '@world-schools/wc-utils'

export type AddOnType = 'activity' | 'service' | 'equipment' | 'language'
export type PricingUnit =
  | 'per_child'
  | 'per_hour'
  | 'per_session'
  | 'per_week'
  | 'per_bag'
  | 'one_time'

/**
 * Add-on price is denominated in the provider's settlement currency
 * (ProviderSettings.currency). There is no per-add-on currency field.
 */
export interface AddOn {
  id: string
  providerId: string
  name: string
  description?: string
  icon?: string
  type: AddOnType
  price: number
  pricingUnit: PricingUnit
  maxQuantity?: number
  quantityUnit?: string
  minAge?: number
  maxAge?: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count?: {
    campAddOns: number
  }
}

/**
 * Add-on currency is always derived server-side from the provider's
 * settlement currency — clients do not pass currency on create/update.
 */
export interface CreateAddOnDto {
  name: string
  description?: string
  icon?: string
  type: AddOnType
  price: number
  pricingUnit: PricingUnit
  maxQuantity?: number
  quantityUnit?: string
  minAge?: number
  maxAge?: number
  sortOrder?: number
}

export interface UpdateAddOnDto {
  name?: string
  description?: string
  icon?: string
  type?: AddOnType
  price?: number
  pricingUnit?: PricingUnit
  maxQuantity?: number
  quantityUnit?: string
  minAge?: number
  maxAge?: number
  isActive?: boolean
  sortOrder?: number
}

export interface QueryAddOnsDto {
  type?: AddOnType
  isActive?: string
  search?: string
  page?: number
  limit?: number
}

export interface AddOnsPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Constants for UI
export const ADD_ON_TYPES = [
  { value: 'activity', label: 'Activity', icon: '🎾', description: 'Sports, lessons, workshops' },
  { value: 'service', label: 'Service', icon: '🚐', description: 'Transfers, laundry, etc.' },
  { value: 'equipment', label: 'Equipment', icon: '📸', description: 'Rentals, photo packages' },
  { value: 'language', label: 'Language', icon: '🗣️', description: 'Extra language courses' },
] as const

export const PRICING_UNITS = [
  { value: 'per_child', label: 'Per child' },
  { value: 'per_hour', label: 'Per hour' },
  { value: 'per_session', label: 'Per session' },
  { value: 'per_week', label: 'Per week' },
  { value: 'per_bag', label: 'Per bag/item' },
  { value: 'one_time', label: 'One-time fee' },
] as const

export const ADD_ON_TYPE_BADGES = {
  activity: { label: 'Activity', className: 'bg-blue-100 text-blue-700' },
  service: { label: 'Service', className: 'bg-purple-100 text-purple-700' },
  equipment: { label: 'Equipment', className: 'bg-green-100 text-green-700' },
  language: { label: 'Language', className: 'bg-orange-100 text-orange-700' },
} as const

// Helper functions
export function formatPricingUnit(unit: PricingUnit): string {
  const unitMap: Record<PricingUnit, string> = {
    per_child: 'per child',
    per_hour: 'per hour',
    per_session: 'per session',
    per_week: 'per week',
    per_bag: 'per bag',
    one_time: 'one-time',
  }
  return unitMap[unit] || unit
}

export function formatPrice(price: number, currency: string, unit: PricingUnit): string {
  return `${formatCurrency(price, currency)} ${formatPricingUnit(unit)}`
}
