import { getLanguageFlag, getLanguageName } from '@world-schools/ui-web'
import type { ActivityItem } from '@/types/camps'
import { COACHING_TYPES, PREDEFINED_SPORTS, SKILL_LEVELS } from '@/constants/sports-activities'
import { PREDEFINED_ARTS } from '@/constants/arts-activities'
import { PREDEFINED_ADVENTURE } from '@/constants/adventure-activities'
import { PREDEFINED_WATER_ACTIVITIES } from '@/constants/water-activities'
import { PREDEFINED_ENVIRONMENTAL } from '@/constants/environmental-activities'
import { PREDEFINED_ACADEMICS, TEACHING_APPROACH } from '@/constants/academics-activities'
import { PREDEFINED_RELIGION } from '@/constants/religion-activities'
import { PREDEFINED_EXCURSIONS } from '@/constants/excursions-activities'

/**
 * Transform activity IDs to full ActivityItem objects
 */
export function transformActivityIds(
  ids: string[] | undefined,
  predefinedActivities: Array<{ id: string; name: string; icon: string }>,
  customActivities?: string[]
): ActivityItem[] {
  if (!ids || ids.length === 0) return []

  const items: ActivityItem[] = []

  // Add predefined activities
  ids.forEach(id => {
    const activity = predefinedActivities.find(a => a.id === id)
    if (activity) {
      items.push(activity)
    }
  })

  // Add custom activities with a generic icon
  if (customActivities && customActivities.length > 0) {
    customActivities.forEach(name => {
      items.push({
        id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        icon: '✨', // Generic icon for custom activities
      })
    })
  }

  return items
}

/**
 * Get display label for skill level
 */
export function getSkillLevelLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  const level = SKILL_LEVELS.find(l => l.value === value)
  return level?.label
}

/**
 * Get display label for coaching type
 */
export function getCoachingTypeLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  const type = COACHING_TYPES.find(t => t.value === value)
  return type?.label
}

/**
 * Get display label for teaching approach
 */
export function getTeachingApproachLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  const approach = TEACHING_APPROACH.find(a => a.value === value)
  return approach?.label
}

/**
 * Transform sports activities data
 */
export function transformSportsActivities(data: any): ActivityItem[] {
  return transformActivityIds(data?.selectedSports, PREDEFINED_SPORTS, data?.customSports)
}

/**
 * Transform language programs data. Selected languages are canonical ISO codes
 * resolved via the shared language source of truth; custom languages pass through.
 */
export function transformLanguagePrograms(data: any): ActivityItem[] {
  const items: ActivityItem[] = []

  ;(data?.selectedLanguages ?? []).forEach((code: string) => {
    items.push({ id: code, name: getLanguageName(code), icon: getLanguageFlag(code) })
  })
  ;(data?.customLanguages ?? []).forEach((name: string) => {
    items.push({
      id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      icon: '✨',
    })
  })

  return items
}

/**
 * Transform arts and crafts data
 */
export function transformArtsAndCrafts(data: any): ActivityItem[] {
  return transformActivityIds(data?.selectedArts, PREDEFINED_ARTS, data?.customArts)
}

/**
 * Transform adventure activities data
 */
export function transformAdventureActivities(data: any): ActivityItem[] {
  return transformActivityIds(
    data?.selectedActivities,
    PREDEFINED_ADVENTURE,
    data?.customActivities
  )
}

/**
 * Transform water activities data
 */
export function transformWaterActivities(data: any): ActivityItem[] {
  return transformActivityIds(
    data?.selectedActivities,
    PREDEFINED_WATER_ACTIVITIES,
    data?.customActivities
  )
}

/**
 * Transform environmental activities data
 */
export function transformEnvironmentalActivities(data: any): ActivityItem[] {
  return transformActivityIds(
    data?.selectedActivities,
    PREDEFINED_ENVIRONMENTAL,
    data?.customActivities
  )
}

/**
 * Transform academics data
 */
export function transformAcademics(data: any): ActivityItem[] {
  return transformActivityIds(data?.selectedSubjects, PREDEFINED_ACADEMICS, data?.customSubjects)
}

/**
 * Transform religion programs data
 */
export function transformReligionPrograms(data: any): ActivityItem[] {
  return transformActivityIds(data?.selectedPrograms, PREDEFINED_RELIGION, data?.customPrograms)
}

/**
 * Transform excursions and trips data
 */
export function transformExcursionsTrips(data: any): ActivityItem[] {
  return transformActivityIds(data?.selectedTrips, PREDEFINED_EXCURSIONS, data?.customTrips)
}
