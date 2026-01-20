// Camp types for wc-booking app

export type CampType = 'day' | 'residential'
export type LocationType = 'provider' | 'different'
export type Gender = 'coed' | 'boys' | 'girls'
export type CampStatus = 'draft' | 'published' | 'archived'

export interface AgeGroup {
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

export interface Camp {
  id: string
  providerId: string
  name: string
  slug: string
  type: CampType
  description: string
  locationType: LocationType
  locationPlaceId?: string
  locationName?: string
  locationAddress?: string
  locationLat?: number
  locationLng?: number
  ageGroups: AgeGroup[]
  languages: string[]
  gender: Gender
  activities: string[]
  photos?: CampPhoto[]
  status: CampStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string

  // Additional JSON fields from schema
  whatsIncluded?: any
  dailySchedule?: any
  meals?: any
  sports?: any
  arts?: any
  adventure?: any
  water?: any
  environmental?: any
  academics?: any
  religion?: any
  excursions?: any
  locationCampus?: any
  accommodation?: any
  gettingThere?: any
  campFocus?: any
  screenPolicy?: any
  safetySupervision?: any

  // Provider relation
  provider?: {
    id: string
    name: string
    logo?: string
  }
}
