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

// Activity Item Interface
export interface ActivityItem {
  id: string
  name: string
  icon: string
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
  scheduleType?: 'daily' | 'weekly' | null
  dailySchedule?: any
  weeklySchedule?: any
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
