/**
 * Shared primitive camp types used across wc-booking, wc-provider, and wc-superadmin.
 *
 * Domain-specific types (e.g. admin moderation statuses, booking flow types) live in each app.
 */

export type CampType = 'day' | 'residential'

export type LocationType = 'provider' | 'different'

export type Gender = 'coed' | 'boys' | 'girls'

/**
 * Base camp status values shared by all apps.
 * wc-superadmin extends this with AdminCampStatus (adds 'pending_review' | 'suspended').
 */
export type BaseCampStatus = 'draft' | 'published' | 'archived'

export interface AgeGroup {
  id?: string
  min: number
  max: number
}

export interface CampPhoto {
  id: string
  url: string
  thumbnail: string
  isPrimary: boolean
  order: number
  caption?: string
}
