import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { School } from '@/types/school'

interface SchoolsState {
  schools: School[]
  isLoading: boolean
  error: string | null
}

interface SchoolsActions {
  getSchools: () => School[]
  getSchoolById: (id: string) => School | undefined
  addSchool: (school: Omit<School, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSchool: (
    id: string,
    updates: Partial<Omit<School, 'id' | 'createdAt' | 'updatedAt'>>
  ) => void
  removeSchool: (id: string) => void
  setSchools: (schools: School[]) => void
  clearError: () => void
  // Progress tracking
  getBasicInfoProgress: (school: School) => number
  getAcademicsProgress: (school: School) => number
  getFeesProgress: (school: School) => number
  getFacilitiesProgress: (school: School) => number
  getOverallProgress: (school: School) => number
}

type SchoolsStore = SchoolsState & SchoolsActions

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const initialSchools: School[] = [
  {
    id: '1',
    name: 'Riverside Elementary School',
    description:
      'A comprehensive elementary school focused on academic excellence and character development.',
    status: 'active',
    capacity: 450,
    enrolled: 420,
    locations: ['Los Angeles, CA'],
    schoolTypes: ['international'],
    curriculum: ['us', 'ib'],
    gradeLevels: ['elementary', 'primary'],
    feeRange: [15000, 25000],
    facilities: ['Swimming Pool', 'Sports Complex', 'Science Labs'],
    specialNeeds: ['Learning Disabilities', 'Gifted Programs'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: '2',
    name: 'Oakwood High School',
    description:
      'A prestigious high school offering advanced placement and college preparatory programs.',
    status: 'active',
    capacity: 1200,
    enrolled: 1150,
    locations: ['San Francisco, CA'],
    schoolTypes: ['boarding'],
    curriculum: ['us', 'ib', 'uk'],
    gradeLevels: ['high'],
    feeRange: [30000, 45000],
    facilities: ['Computer Labs', 'Library', 'Auditorium', 'Cafeteria'],
    specialNeeds: ['Gifted Programs', 'Language Support'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: '3',
    name: 'Sunset Valley Middle School',
    description: 'A progressive middle school with innovative learning approaches.',
    status: 'pending',
    capacity: 680,
    enrolled: 0,
    locations: ['San Diego, CA'],
    schoolTypes: ['international'],
    curriculum: ['us'],
    gradeLevels: ['middle'],
    feeRange: [20000, 35000],
    facilities: ['Music Room', 'Art Studio', 'Playground'],
    specialNeeds: ['ADHD Support', 'Speech Therapy'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-12'),
  },
]

export const useSchoolsStore = create<SchoolsStore>()(
  immer((set, get) => ({
    schools: initialSchools,
    isLoading: false,
    error: null,

    getSchools: () => get().schools,

    getSchoolById: (id: string) => get().schools.find(s => s.id === id),

    addSchool: schoolData => {
      set(state => {
        const now = new Date()
        const newSchool: School = {
          ...schoolData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        }
        state.schools.push(newSchool)
      })
    },

    updateSchool: (id, updates) => {
      set(state => {
        const idx = state.schools.findIndex(s => s.id === id)
        if (idx !== -1) {
          state.schools[idx] = {
            ...state.schools[idx],
            ...updates,
            updatedAt: new Date(),
          }
        }
      })
    },

    removeSchool: id => {
      set(state => {
        state.schools = state.schools.filter(s => s.id !== id)
      })
    },

    setSchools: schools => {
      set(state => {
        state.schools = schools
      })
    },

    clearError: () => {
      set(state => {
        state.error = null
      })
    },

    // Progress helpers
    getBasicInfoProgress: (school: School) => {
      const completed = [
        school.name?.trim(),
        school.status,
        typeof school.capacity === 'number' && school.capacity > 0,
      ].filter(Boolean).length
      return (completed / 3) * 100
    },

    getAcademicsProgress: (school: School) => {
      const completed = [
        school.locations.length > 0,
        school.schoolTypes.length > 0,
        school.curriculum.length > 0,
        school.gradeLevels.length > 0,
      ].filter(Boolean).length
      return (completed / 4) * 100
    },

    getFeesProgress: (school: School) => {
      const [min, max] = school.feeRange || [0, 0]
      const valid = typeof min === 'number' && typeof max === 'number' && min <= max
      return valid ? 100 : 0
    },

    getFacilitiesProgress: (school: School) => {
      const completed = [
        school.facilities.length > 0,
        school.specialNeeds.length > 0,
        Boolean(school.description && school.description.trim().length > 0),
      ].filter(Boolean).length
      return (completed / 3) * 100
    },

    getOverallProgress: (school: School) => {
      const b = get().getBasicInfoProgress(school)
      const a = get().getAcademicsProgress(school)
      const f = get().getFeesProgress(school)
      const z = get().getFacilitiesProgress(school)
      const weighted = b * 0.25 + a * 0.35 + f * 0.2 + z * 0.2
      return Math.round(weighted)
    },
  }))
)
