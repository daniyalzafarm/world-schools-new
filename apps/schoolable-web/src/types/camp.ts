export interface Camp {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'inactive' | 'pending'
  capacity: number
  minAge?: number
  maxAge?: number
  locations: string[]
  campTypes: string[]
  dateRange: {
    startDate?: Date
    endDate?: Date
  }
  activities: string[]
  priceRange: [number, number]
  facilities: string[]
  specialNeeds: string[]
  enrolled?: number
  season?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateCampData {
  name: string
  description?: string
  status: 'draft' | 'active' | 'inactive' | 'pending'
  capacity: number
  minAge?: number
  maxAge?: number
  locations: string[]
  campTypes: string[]
  dateRange: {
    startDate?: Date
    endDate?: Date
  }
  activities: string[]
  priceRange: [number, number]
  facilities: string[]
  specialNeeds: string[]
}

export interface UpdateCampData extends CreateCampData {
  id: string
}

export const CAMP_STATUS_OPTIONS = [
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
] as const

export const CAMP_TYPE_OPTIONS = [
  { id: 'day', label: 'Day Camp' },
  { id: 'residential', label: 'Residential' },
  { id: 'online', label: 'Online' },
] as const

export const ACTIVITY_OPTIONS = [
  { id: 'language', label: 'Language lessons' },
  { id: 'multisport', label: 'Multisport' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'coding', label: 'Coding' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'arts_crafts', label: 'Arts & crafts' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'tennis', label: 'Tennis' },
] as const

export const FACILITY_OPTIONS = [
  'Accommodation',
  'Meals',
  'Medical Staff',
  'Indoor Courts',
  'Outdoor Fields',
  'Swimming Pool',
] as const

export const SPECIAL_NEEDS_OPTIONS = [
  'Dietary Needs',
  'Physical Disabilities',
  'Language Support',
  'Autism Support',
  'ADHD Support',
] as const

export const LOCATION_SUGGESTIONS = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'San Jose',
]
