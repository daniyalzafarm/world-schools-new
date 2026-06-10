// ============================================
// Core Interfaces - Camp-Focused Data Model
// ============================================

export interface EmergencyContact {
  id: string
  name: string
  relationship:
    | 'Father'
    | 'Mother'
    | 'Stepfather'
    | 'Stepmother'
    | 'Grandparent'
    | 'Aunt / Uncle'
    | 'Godparent'
    | 'Adult sibling'
    | 'Family friend'
    | 'Nanny / Au pair'
    | 'Doctor / Pediatrician'
    | 'Other'
  primaryPhone: string
  secondaryPhone?: string
  email?: string
  authorizedForPickup: boolean
  notes?: string
}

export interface MedicalInfo {
  allergies: string[] // Multi-select from predefined list + custom
  dietaryRequirements: string[] // Multi-select from predefined list + custom
  medications?: string
  medicalConditions?: string
  specialNeeds?: string
  swimmingAbility?: 'cannot_swim' | 'beginner' | 'intermediate' | 'advanced' | 'competitive'
  doctorName?: string
  doctorPhone?: string
  insuranceInfo?: string
}

export interface CampPreferences {
  interests: string[] // Sports, Arts, Adventure, STEM, Nature, Languages
  preferredCampTypes: string[] // Day camp, Overnight, Residential, etc.
  campSize?: string // 'any' | 'small' | 'medium' | 'large'
  environmentPreferences?: string[] // International mix, Inclusive, Screen-free, etc.
  valuesPreferences?: string[] // Safety first, Quality staff, Great facilities, etc.
  locationPreferences?: {
    maxDistance?: number // in km
    preferredAreas?: string[]
  }
  budgetRange?: {
    min?: number
    max?: number
    currency: string
  }
  preferredDuration?: string[] // '1-3 days', '4-7 days', '1-2 weeks', '2+ weeks'
  languagesSpoken: string[]
  previousCampExperience?: string
}

export interface Child {
  id: string
  parentId: string

  // Basic info (30% weight)
  firstName: string
  lastName?: string
  nickname?: string
  dateOfBirth: Date | string
  gender: 'boy' | 'girl'
  photoUrl?: string
  schoolYear?: string // Normalized year number (1-13)
  schoolCountry?: string // Country code (UK, US, etc.)
  languages?: string[] // Languages spoken by the child

  // Medical (20% weight)
  medicalInfo: MedicalInfo | null

  // Emergency contacts (25% weight)
  emergencyContacts: EmergencyContact[]

  // Preferences (15% weight)
  campPreferences: CampPreferences | null

  // Meta
  profileCompletion: number // 0-100
  archived: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ChildFormSection {
  id: string
  title: string
  progress: number // 0-1
  iconName: string
  completed: boolean
}

// ============================================
// Constants and Enums
// ============================================

export const GENDER_OPTIONS = ['boy', 'girl'] as const

export const ALLERGY_OPTIONS = [
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Eggs',
  'Gluten',
  'Shellfish',
  'Fish',
  'Soy',
  'Sesame',
  'Bee stings',
  'Other',
] as const

export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-free',
  'Dairy-free',
  'Other',
] as const

export const SWIMMING_LEVELS = [
  { value: 'cannot_swim', label: 'Cannot swim' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'competitive', label: 'Competitive' },
] as const

// Flat array for backward compatibility and type checking
export const RELATIONSHIP_OPTIONS = [
  'Father',
  'Mother',
  'Stepfather',
  'Stepmother',
  'Grandparent',
  'Aunt / Uncle',
  'Godparent',
  'Adult sibling',
  'Nanny / Au pair',
  'Family friend',
  'Doctor / Pediatrician',
  'Other',
] as const

// Grouped sections for SelectField with sections prop
export const RELATIONSHIP_SECTIONS = [
  {
    title: 'Family',
    items: [
      'Father',
      'Mother',
      'Stepfather',
      'Stepmother',
      'Grandparent',
      'Aunt / Uncle',
      'Godparent',
      'Adult sibling',
    ],
  },
  {
    title: 'Caregiver',
    items: ['Nanny / Au pair', 'Family friend'],
  },
  {
    title: 'Medical',
    items: ['Doctor / Pediatrician'],
  },
  {
    title: 'Other',
    items: ['Other'],
  },
] as const

export const INTEREST_CATEGORIES = {
  sports: ['Football', 'Basketball', 'Tennis', 'Swimming', 'Volleyball', 'Athletics'],
  arts: ['Painting', 'Music', 'Drama', 'Dance', 'Photography', 'Crafts'],
  adventure: ['Climbing', 'Hiking', 'Camping', 'Kayaking', 'Archery', 'Survival Skills'],
  stem: ['Coding', 'Robotics', 'Science', 'Engineering', 'Mathematics', 'Technology'],
  nature: ['Animals', 'Environment', 'Farming', 'Gardening', 'Wildlife', 'Conservation'],
  languages: ['Spanish', 'French', 'German', 'Mandarin', 'Arabic', 'Other'],
} as const

export const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Arabic',
  'Chinese',
  'Hindi',
  'Portuguese',
  'Russian',
  'Italian',
  'Japanese',
  'Korean',
] as const

// Emoji-based options for camp preferences (matching reference design)
export const INTEREST_OPTIONS_WITH_EMOJIS = [
  { id: 'traditional', emoji: '🏕️', label: 'Traditional' },
  { id: 'sports', emoji: '⚽', label: 'Sports' },
  { id: 'arts_creative', emoji: '🎨', label: 'Arts & Creative' },
  { id: 'language', emoji: '🗣️', label: 'Language' },
  { id: 'adventure', emoji: '🧗', label: 'Adventure' },
  { id: 'performing_arts', emoji: '🎭', label: 'Performing Arts' },
  { id: 'stem_science', emoji: '🔬', label: 'STEM & Science' },
  { id: 'water_sports', emoji: '🏄', label: 'Water Sports' },
  { id: 'horseback', emoji: '🐴', label: 'Horseback' },
  { id: 'music', emoji: '🎸', label: 'Music' },
  { id: 'nature_wildlife', emoji: '🌲', label: 'Nature & Wildlife' },
  { id: 'wellness', emoji: '🧘', label: 'Wellness' },
] as const

export const CAMP_TYPE_OPTIONS_WITH_EMOJIS = [
  { id: 'day_camp', emoji: '☀️', label: 'Day Camp' },
  { id: 'overnight_camp', emoji: '🌙', label: 'Overnight Camp' },
  { id: 'residential_camp', emoji: '🏠', label: 'Residential Camp' },
  { id: 'sports_camp', emoji: '⚽', label: 'Sports Camp' },
  { id: 'arts_camp', emoji: '🎨', label: 'Arts Camp' },
  { id: 'stem_camp', emoji: '🔬', label: 'STEM Camp' },
  { id: 'adventure_camp', emoji: '🧗', label: 'Adventure Camp' },
  { id: 'language_immersion', emoji: '🗣️', label: 'Language Immersion' },
] as const

export const ENVIRONMENT_OPTIONS = [
  { id: 'international_mix', emoji: '🌍', label: 'International mix' },
  { id: 'inclusive', emoji: '🤝', label: 'Inclusive' },
  { id: 'screen_free', emoji: '📵', label: 'Screen-free' },
  { id: 'eco_friendly', emoji: '🌱', label: 'Eco-friendly' },
  { id: 'competitive', emoji: '🏆', label: 'Competitive' },
  { id: 'relaxed_pace', emoji: '😌', label: 'Relaxed pace' },
  { id: 'skill_focused', emoji: '🎯', label: 'Skill-focused' },
  { id: 'fun_first', emoji: '🎉', label: 'Fun-first' },
  { id: 'educational', emoji: '🧠', label: 'Educational' },
] as const

export const VALUES_OPTIONS = [
  { id: 'safety_first', emoji: '🛡️', label: 'Safety first' },
  { id: 'quality_staff', emoji: '👨‍🏫', label: 'Quality staff' },
  { id: 'great_facilities', emoji: '🏠', label: 'Great facilities' },
  { id: 'quality_food', emoji: '🍽️', label: 'Quality food' },
  { id: 'small_groups', emoji: '👥', label: 'Small groups' },
  { id: 'photo_updates', emoji: '📸', label: 'Photo updates' },
  { id: 'easy_contact', emoji: '📞', label: 'Easy contact' },
  { id: 'highly_rated', emoji: '⭐', label: 'Highly rated' },
  { id: 'returner_friendly', emoji: '🔄', label: 'Returner-friendly' },
] as const

// Camp Size Options (for radio group)
export const CAMP_SIZE_OPTIONS = [
  { id: 'any', label: 'No preference', description: 'Open to all camp sizes' },
  { id: 'small', label: 'Small & intimate', description: 'Under 50 campers' },
  { id: 'medium', label: 'Medium', description: '50-150 campers' },
  { id: 'large', label: 'Large & vibrant', description: '150+ campers' },
] as const

// ============================================
// Helper Functions
// ============================================

/**
 * Create an empty child object for form initialization
 * Only includes minimal required fields for creation
 */
export const createEmptyChild = (): Omit<
  Child,
  'id' | 'createdAt' | 'updatedAt' | 'parentId' | 'profileCompletion' | 'archived'
> => ({
  firstName: '',
  lastName: undefined,
  nickname: undefined,
  dateOfBirth: '',
  gender: 'boy',
  photoUrl: undefined,
  schoolYear: undefined,
  medicalInfo: null,
  emergencyContacts: [],
  campPreferences: null,
})

/**
 * Get child's display name
 * Priority: nickname > firstName lastName > firstName
 */
export const getChildDisplayName = (child: Child): string => {
  if (child.nickname) return child.nickname
  if (child.lastName) return `${child.firstName} ${child.lastName}`
  return child.firstName || 'Unnamed Child'
}

/**
 * Calculate child's age from date of birth
 */
export const getChildAge = (child: Child): number | null => {
  if (!child.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(child.dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/**
 * Check if child is eligible for booking
 * Requirements: profileCompletion >= 75% AND at least 1 emergency contact
 */
export const isBookingEligible = (child: Child): boolean => {
  return child.profileCompletion >= 75 && child.emergencyContacts.length >= 1
}
