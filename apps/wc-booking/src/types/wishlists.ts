import type { Camp } from './camps'
import type { Child } from './child'
import type { Session } from './sessions'

// ============================================
// Enums
// ============================================

export type WishlistShareRole = 'viewer' | 'editor'

// ============================================
// Core Interfaces
// ============================================

export interface WishlistShare {
  id: string
  wishlistId: string
  email: string
  userId: string | null
  role: WishlistShareRole
  createdAt: string
  updatedAt: string
}

export interface WishlistChild {
  id: string
  wishlistId: string
  childId: string
  createdAt: string
  child: Pick<Child, 'id' | 'firstName' | 'lastName' | 'photoUrl' | 'dateOfBirth'> | null
}

export interface WishlistItemCamp {
  id: string
  name: string
  slug: string
  type: Camp['type']
  locationName: Camp['locationName']
  locationAddress: Camp['locationAddress']
  locationLat?: number | null
  locationLng?: number | null
  ageGroups: Camp['ageGroups']
  languages: Camp['languages']
  gender: Camp['gender']
  photos: Camp['photos']
  status: string
  provider?: {
    settings?: { currency?: string } | null
    googleBusinessProfile?: {
      placeId?: string | null
      rating?: number | null
      reviewsCount?: number | null
      city?: string | null
      country?: string | null
    } | null
  } | null
  overallRating?: number | null
  totalReviews?: number
  sessions?: Session[]
}

export interface WishlistItem {
  id: string
  wishlistId: string
  campId: string
  sessionId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  camp: WishlistItemCamp | null
  selectedSession: Session | null
}

export interface Wishlist {
  id: string
  parentId: string
  name: string
  icon: string | null
  isLinkSharingEnabled: boolean
  shareToken: string | null
  campCount: number
  shareCount: number
  coverPhotos: string[]
  campIds: string[]
  shares: WishlistShare[]
  children: WishlistChild[]
  createdAt: string
  updatedAt: string
}

export interface WishlistDetail extends Wishlist {
  items: WishlistItem[]
  ownerName?: string
}

export interface SharedWithMeEntry {
  wishlist: Wishlist
  role: WishlistShareRole
  sharedBy: string
}

// ============================================
// Payloads
// ============================================

export interface CreateWishlistPayload {
  name: string
  icon?: string
  childIds?: string[]
}

export interface UpdateWishlistPayload {
  name?: string
  icon?: string
  childIds?: string[]
}

export interface AddWishlistItemPayload {
  campId: string
  sessionId?: string
}

export interface UpdateWishlistItemPayload {
  sessionId: string | null
}

export interface ShareWishlistPayload {
  email: string
  role?: WishlistShareRole
}

export interface UpdateShareRolePayload {
  role: WishlistShareRole
}
