import { LANGUAGES_DATA } from '@world-schools/ui-web'

/**
 * Predefined language catalog, derived from the shared language source of truth.
 * `id` is the canonical ISO code so selections persist as codes.
 */
export const PREDEFINED_LANGUAGES = LANGUAGES_DATA.map(language => ({
  id: language.code,
  name: language.name,
  icon: language.flag,
}))

export const LANGUAGE_PROFICIENCY_LEVELS = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'No prior knowledge required',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Some basic knowledge helpful',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Fluency improvement',
  },
  {
    value: 'all',
    label: 'All Levels',
    description: 'Mixed ability groups',
  },
]

export const TEACHING_METHODS = [
  {
    value: 'immersive',
    label: 'Immersive',
    description: 'Full language immersion',
  },
  {
    value: 'classroom',
    label: 'Classroom',
    description: 'Traditional lessons',
  },
  {
    value: 'conversational',
    label: 'Conversational',
    description: 'Focus on speaking',
  },
  {
    value: 'mixed',
    label: 'Mixed Approach',
    description: 'Combination of methods',
  },
]
