export interface PersonalInfo {
  firstName: string
  lastName: string
  dateOfBirth?: Date | string // Can be Date object or ISO string from API
  gender?: 'Male' | 'Female' | 'Other'
  nationality?: string
  languages: string[]
}

export interface AcademicPreferences {
  currentGrade?: string
  favoriteSubjects: string[]
  learningStyle?: 'Visual' | 'Auditory' | 'Kinesthetic' | 'Reading/Writing'
  languagesOfInstruction: string[]
  interestedInBoarding?: 'Yes' | 'No'
}

export interface ExtraCurricular {
  interests: string[]
  preferredSchedule?: 'Weekday' | 'Weekend' | 'After school'
}

export interface SpecialNeeds {
  areas: string[]
  supportNeeds: string[]
  additionalNotes?: string
}

export interface Child {
  id: string
  personalInfo: PersonalInfo
  academicPreferences: AcademicPreferences
  extraCurricular: ExtraCurricular
  specialNeeds: SpecialNeeds
  createdAt: Date | string // Can be Date object or ISO string from API
  updatedAt: Date | string // Can be Date object or ISO string from API
}

export interface ChildFormSection {
  id: string
  title: string
  progress: number // 0-1
  iconName: string
  completed: boolean
}

// Constants from mobile implementation
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const

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

export const GRADE_OPTIONS = [
  'Nursery',
  'Kindergarten',
  'Primary',
  'Middle School',
  'High School',
] as const

export const SUBJECT_OPTIONS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Geography',
  'Computer Science',
  'Art',
  'Music',
  'Economics',
  'Biology',
  'Chemistry',
  'Physics',
] as const

export const LEARNING_STYLES = ['Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing'] as const

export const ACTIVITY_OPTIONS = [
  'Soccer',
  'Basketball',
  'Swimming',
  'Tennis',
  'Coding',
  'Robotics',
  'Art',
  'Music',
  'Dance',
  'Debate',
  'Drama',
  'Volunteering',
] as const

export const SCHEDULE_OPTIONS = ['Weekday', 'Weekend', 'After school'] as const

export const SPECIAL_NEEDS_AREAS = [
  'Learning Disabilities',
  'Physical Disabilities',
  'Autism Spectrum',
  'ADHD',
  'Speech & Language',
  'Behavioral Support',
  'Gifted & Talented',
  'Emotional Support',
] as const

export const SUPPORT_NEEDS = [
  'Individual Education Plan',
  'One-on-one Aide',
  'Occupational Therapy',
  'Speech Therapy',
  'Counseling',
  'Assistive Technology',
  'Exam Accommodations',
] as const

// Helper functions
export const createEmptyChild = (): Omit<Child, 'id' | 'createdAt' | 'updatedAt'> => ({
  personalInfo: {
    firstName: '',
    lastName: '',
    languages: ['English'],
  },
  academicPreferences: {
    favoriteSubjects: [],
    languagesOfInstruction: ['English'],
  },
  extraCurricular: {
    interests: [],
  },
  specialNeeds: {
    areas: [],
    supportNeeds: [],
  },
})

export const calculateSectionProgress = (child: Child, sectionId: string): number => {
  switch (sectionId) {
    case 'personal': {
      const { personalInfo } = child
      const personalFields = [
        personalInfo.firstName,
        personalInfo.dateOfBirth,
        personalInfo.gender,
        personalInfo.nationality,
      ]
      const personalCompleted = personalFields.filter(Boolean).length
      return personalCompleted / personalFields.length
    }

    case 'academic': {
      const { academicPreferences } = child
      const academicFields = [
        academicPreferences.currentGrade,
        academicPreferences.favoriteSubjects.length > 0,
        academicPreferences.learningStyle,
        academicPreferences.languagesOfInstruction.length > 0,
        academicPreferences.interestedInBoarding,
      ]
      const academicCompleted = academicFields.filter(Boolean).length
      return academicCompleted / academicFields.length
    }

    case 'extra': {
      const { extraCurricular } = child
      const extraFields = [extraCurricular.interests.length > 0, extraCurricular.preferredSchedule]
      const extraCompleted = extraFields.filter(Boolean).length
      return extraCompleted / extraFields.length
    }

    case 'special': {
      // Special needs is optional, so if no areas are selected, it's considered complete
      const { specialNeeds } = child
      if (specialNeeds.areas.length === 0) return 1
      return specialNeeds.supportNeeds.length > 0 ? 1 : 0.5
    }

    default:
      return 0
  }
}

export const getChildDisplayName = (child: Child): string => {
  const firstName = child.personalInfo.firstName || ''
  const lastName = child.personalInfo.lastName || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || 'Unnamed Child'
}

export const getChildAge = (child: Child): number | null => {
  if (!child.personalInfo.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(child.personalInfo.dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}
