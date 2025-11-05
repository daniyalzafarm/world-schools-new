export interface School {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'inactive' | 'pending'
  capacity: number
  enrolled?: number
  locations: string[]
  schoolTypes: string[]
  curriculum: string[]
  gradeLevels: string[]
  feeRange: [number, number]
  facilities: string[]
  specialNeeds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateSchoolData {
  name: string
  description?: string
  status: 'draft' | 'active' | 'inactive' | 'pending'
  capacity: number
  locations: string[]
  schoolTypes: string[]
  curriculum: string[]
  gradeLevels: string[]
  feeRange: [number, number]
  facilities: string[]
  specialNeeds: string[]
}

export interface UpdateSchoolData extends CreateSchoolData {
  id: string
}

export const SCHOOL_STATUS_OPTIONS = [
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
] as const

export const SCHOOL_TYPE_OPTIONS = [
  { id: 'international', label: 'International' },
  { id: 'boarding', label: 'Boarding' },
  { id: 'online', label: 'Online' },
] as const

export const CURRICULUM_OPTIONS = [
  { id: 'us', label: 'US' },
  { id: 'ib', label: 'IB' },
  { id: 'uk', label: 'UK' },
  { id: 'french', label: 'French' },
  { id: 'german', label: 'German' },
  { id: 'canadian', label: 'Canadian' },
  { id: 'australian', label: 'Australian' },
  { id: 'indian', label: 'Indian' },
] as const

export const GRADE_LEVEL_OPTIONS = [
  { id: 'nursery', label: 'Nursery' },
  { id: 'preschool', label: 'Preschool' },
  { id: 'kindergarten', label: 'Kindergarten' },
  { id: 'elementary', label: 'Elementary' },
  { id: 'primary', label: 'Primary' },
  { id: 'middle', label: 'Middle School' },
  { id: 'high', label: 'High School' },
] as const

export const SCHOOL_FACILITY_OPTIONS = [
  'Swimming Pool',
  'Sports Complex',
  'Science Labs',
  'Computer Labs',
  'Library',
  'Auditorium',
  'Cafeteria',
  'Music Room',
  'Art Studio',
  'Playground',
] as const

export const SCHOOL_SPECIAL_NEEDS_OPTIONS = [
  'Learning Disabilities',
  'Physical Disabilities',
  'Gifted Programs',
  'Language Support',
  'Behavioral Support',
  'Autism Support',
  'ADHD Support',
  'Speech Therapy',
  'Occupational Therapy',
] as const

export const SCHOOL_LOCATION_SUGGESTIONS = [
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
