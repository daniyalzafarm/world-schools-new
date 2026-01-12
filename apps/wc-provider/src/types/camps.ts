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
  directions: string
  transportation: string[]
  description?: string
}

export interface CampFocus {
  focus: string[]
  description?: string
}

export type CampType = 'day' | 'residential'
export type LocationType = 'provider' | 'different'
export type Gender = 'coed' | 'boys' | 'girls'
export type CampStatus = 'draft' | 'published' | 'archived'

export interface Camp {
  id: string
  providerId: string
  name: string
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
  dailySchedule?: DailyScheduleItem[]
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
  status: CampStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCampDto {
  name: string
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
