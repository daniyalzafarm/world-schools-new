// Camp types for wc-booking app
import type { Session } from './sessions'
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

// wc-booking uses the base statuses only (no admin-specific pending_review / suspended)
export type CampStatus = BaseCampStatus

export type SessionType = 'flexible' | 'fixed'

// Activity Item Interface
export interface ActivityItem {
  id: string
  name: string
  icon: string
  photoUrl?: string
  subtitle?: string
}

// Program Meta Card Interface
export interface MetaCard {
  label: string
  value: string
}

// Sports Activities
export interface SportsActivities {
  description?: string
  skillLevel?: string
  coachingType?: string
  badges?: string[]
  items?: ActivityItem[]
}

// Language Programs
export interface LanguagePrograms {
  description?: string
  classSize?: string
  teachingMethod?: string
  items?: ActivityItem[]
}

// Arts & Crafts
export interface ArtsAndCrafts {
  description?: string
  materials?: string
  items?: ActivityItem[]
}

// Adventure Activities
export interface AdventureActivities {
  description?: string
  safetyLevel?: string
  items?: ActivityItem[]
}

// Water Activities
export interface WaterActivities {
  description?: string
  supervision?: string
  items?: ActivityItem[]
}

// Environmental Activities
export interface EnvironmentalActivities {
  description?: string
  items?: ActivityItem[]
}

// Academics
export interface Academics {
  description?: string
  classSize?: string
  items?: ActivityItem[]
  badges?: string[]
}

// Religion Programs
export interface ReligionPrograms {
  tradition?: string
  description?: string
  observances?: string[]
}

// Excursions & Trips
export interface ExcursionsTrips {
  description?: string
  frequency?: string
  items?: ActivityItem[]
}

export interface TimeSlot {
  id: string
  time: string
  activity: string
  description?: string
}

export interface DailyScheduleData {
  timeSlots: TimeSlot[]
}

export interface WeeklyScheduleData {
  monday: { timeSlots: TimeSlot[] }
  tuesday: { timeSlots: TimeSlot[] }
  wednesday: { timeSlots: TimeSlot[] }
  thursday: { timeSlots: TimeSlot[] }
  friday: { timeSlots: TimeSlot[] }
  saturday: { timeSlots: TimeSlot[] }
  sunday: { timeSlots: TimeSlot[] }
}

export interface CampusFacilities {
  description?: string
  campusSize?: string
  campusSetting?: string
  selectedFacilities?: string[]
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

  // Phase 9: per-camp deposit settings (snapshotted from provider on create,
  // editable per camp by the provider). The booking flow reads these
  // directly off the camp; provider-level deposit fields are NO LONGER
  // consulted by the parent UI.
  depositRequired?: boolean
  depositType?: 'percentage' | 'fixed' | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null

  // Additional JSON fields from schema
  whatsIncluded?: any
  scheduleType?: 'daily' | 'weekly' | null
  dailySchedule?: DailyScheduleData
  weeklySchedule?: WeeklyScheduleData
  meals?: any
  sports?: SportsActivities
  languagePrograms?: LanguagePrograms
  arts?: ArtsAndCrafts
  adventure?: AdventureActivities
  water?: WaterActivities
  environmental?: EnvironmentalActivities
  academics?: Academics
  religion?: ReligionPrograms
  excursions?: ExcursionsTrips
  campusFacilities?: CampusFacilities
  locationCampus?: any
  accommodation?: any
  gettingThere?: any
  campFocus?: any
  campFocusRecord?: {
    activity: { id: string; name: string; emoji?: string | null; slug: string }
    category: { id: string; name: string; emoji?: string | null; slug: string }
  } | null
  screenPolicy?: {
    description: string
  } | null
  safetySupervision?: {
    staffRatios?: { label: string; value: string }[]
    items?: string[]
    description?: string
  } | null
  sessionType?: SessionType | null

  // Relations
  provider?: {
    id: string
    stripeAccountId: string | null
    legalCompanyName: string
    legalStreetAddress?: string
    legalCity?: string
    legalStateProvince?: string
    legalPostalCode?: string
    legalCountry?: string
    phone?: string
    email?: string
    website?: string
    yearFounded?: number
    description?: string
    trustScore?: number | null
    approvalStatus?: string
    logoUrl?: string | null
    responseRate?: number | null
    avgReplyTimeMinutes?: number | null
    _count?: { camps: number }
    googleBusinessProfile?: {
      placeId?: string
      businessName: string
      formattedAddress: string
      rating?: number
      reviewsCount?: number
      phone?: string
      website?: string
    }
    settings?: {
      currency: string
      cancellationPolicy: string
      cancellationPolicyCustom?: any
      depositRequired?: boolean
      depositType?: string | null
      depositPercentage?: number | null
      depositFixedAmount?: number | null
    }
  }
  sessions?: Session[]
}
