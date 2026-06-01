/**
 * Formatting utilities for sessions
 */

import { formatCurrency as formatCurrencyFromUtils } from '@world-schools/wc-utils'

/**
 * Format date to readable string (e.g., "Jan 15, 2024")
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format date to short string (e.g., "Jan 15")
 */
export function formatDateShort(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date range (e.g., "Jan 15 - Feb 20, 2024")
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startYear === endYear) {
    return `${formatDateShort(start)} - ${formatDate(end)}`
  } else {
    return `${formatDate(start)} - ${formatDate(end)}`
  }
}

/**
 * Format currency (e.g., "$1,234") — shared Intl-based implementation.
 * `currency` is required (no silent default) to keep currency display honest.
 */
export function formatCurrency(amount: number, currency: string): string {
  return formatCurrencyFromUtils(amount, currency)
}

/**
 * Format capacity (e.g., "50 spots" or "Unlimited")
 */
export function formatCapacity(capacity?: number): string {
  if (capacity === undefined || capacity === null) {
    return 'Unlimited'
  }
  return `${capacity} ${capacity === 1 ? 'spot' : 'spots'}`
}

/**
 * Format capacity with booked (e.g., "30/50 spots" or "30 booked")
 */
export function formatCapacityWithBooked(capacity?: number, booked = 0): string {
  if (capacity === undefined || capacity === null) {
    return `${booked} booked`
  }
  return `${booked}/${capacity} ${capacity === 1 ? 'spot' : 'spots'}`
}

/**
 * Format duration (e.g., "2 weeks" or "1 week, 3 days")
 */
export function formatDuration(weeks: number, days = 0): string {
  const parts: string[] = []

  if (weeks > 0) {
    parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`)
  }

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  }

  return parts.join(', ') || '0 days'
}

/**
 * Format session status
 */
export function formatSessionStatus(status: 'draft' | 'published'): string {
  return status === 'published' ? 'Published' : 'Draft'
}

/**
 * Format ISO date to input value (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format number with commas (e.g., 1234 -> "1,234")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format percentage (e.g., 0.75 -> "75%")
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * Format capacity percentage (e.g., 30/50 -> "60%")
 */
export function formatCapacityPercentage(capacity?: number, booked = 0): string {
  if (capacity === undefined || capacity === null) {
    return 'N/A'
  }
  if (capacity === 0) {
    return '0%'
  }
  const percentage = (booked / capacity) * 100
  return `${Math.round(percentage)}%`
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}
