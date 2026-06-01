import type {
  AgeGroup,
  BaseCampStatus,
  CampPhoto,
  CampType,
  Gender,
  LocationType,
} from '@world-schools/wc-types'

// Re-export shared primitives for local usage
export type { AgeGroup, CampPhoto, CampType, Gender, LocationType }

export interface WhatsIncluded {
  items: string[]
  customItems: string[]
}

export interface DailyScheduleItem {
  time: string
  activity: string
  description?: string
}

export interface MealsInfo {
  breakfast: boolean
  lunch: boolean
  dinner: boolean
  snacks: boolean
  dietary: string[]
  description?: string
}

export interface ActivityDetails {
  selected: string[]
  description?: string
  details?: Record<string, any>
}

export interface CampusFacilities {
  facilities: string[]
  description?: string
}

export interface Accommodation {
  type: string
  rooms: string[]
  amenities: string[]
  description?: string
}

export interface GettingThere {
  description?: string
  transportIncluded?: string
  pickupLocations?: string
  selectedTransport?: string[]
}

export interface PrimaryFocus {
  activityId: string
  activityName: string
  categoryId: string
  categoryName: string
  icon: string
}

export interface CampFocus {
  primaryFocus?: PrimaryFocus | null
  description?: string
  philosophy?: string
  learningApproach?: string
}

// wc-provider uses the base statuses only (no admin-specific pending_review / suspended)
export type CampStatus = BaseCampStatus

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
  whatsIncluded?: WhatsIncluded
  scheduleType?: 'daily' | 'weekly' | null
  dailySchedule?: DailyScheduleItem[] | any
  weeklySchedule?: any
  meals?: MealsInfo
  sportsActivities?: ActivityDetails
  languagePrograms?: ActivityDetails
  artsAndCrafts?: ActivityDetails
  adventureActivities?: ActivityDetails
  waterActivities?: ActivityDetails
  environmentalActivities?: ActivityDetails
  academics?: ActivityDetails
  religionPrograms?: ActivityDetails
  excursionsTrips?: ActivityDetails
  campusFacilities?: CampusFacilities
  accommodation?: Accommodation
  gettingThere?: GettingThere
  campFocus?: CampFocus
  safetySupervision?: {
    description?: string
    staffRatios?: { label: string; value: string }[]
    items?: string[]
  } | null
  screenPolicy?: {
    description: string
  } | null
  sessionType?: 'flexible' | 'fixed' | null
  currency: string // ISO 4217 currency code. Inherited from ProviderSettings.currency, always present.
  sessionsCount?: { published: number; total: number }
  addOnsCount?: { enabled: number; total: number }
  eligibilityCount?: number
  status: CampStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCampDto {
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
}

export interface UpdateCampAudienceDto {
  ageGroups: AgeGroup[]
  languages: string[]
  gender: Gender
}

export interface UpdateCampProgramsDto {
  activities: string[]
}

export interface UpdateCampPhotosDto {
  photos: CampPhoto[]
}

export const ACTIVITY_CATEGORIES = [
  'sports',
  'languages',
  'arts',
  'adventure',
  'water',
  'environmental',
  'academics',
  'religion',
  'excursions',
  'music',
] as const

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]
