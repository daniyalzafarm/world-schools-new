import { PREDEFINED_SPORTS } from '../constants/sports-activities'
import { PREDEFINED_ARTS } from '../constants/arts-activities'
import { PREDEFINED_LANGUAGES } from '../constants/languages-activities'
import { PREDEFINED_ACADEMICS } from '../constants/academics-activities'
import { PREDEFINED_ADVENTURE } from '../constants/adventure-activities'
import { PREDEFINED_WATER_ACTIVITIES } from '../constants/water-activities'
import { PREDEFINED_ENVIRONMENTAL } from '../constants/environmental-activities'
import type { Camp } from '../types/camps'

export interface ActivityWithCategory {
  id: string
  name: string
  icon: string
  categoryId: string
  categoryName: string
}

export interface ActivityCategory {
  id: string
  name: string
  activities: ActivityWithCategory[]
}

/**
 * Get all activities organized by category based on camp's selected programs
 */
export function getActivitiesByCategory(camp: Camp | null): ActivityCategory[] {
  if (!camp?.activities || camp.activities.length === 0) {
    return []
  }

  const categories: ActivityCategory[] = []

  // Sports
  if (camp.activities.includes('sports')) {
    categories.push({
      id: 'sports',
      name: 'Sports',
      activities: PREDEFINED_SPORTS.map(sport => ({
        ...sport,
        categoryId: 'sports',
        categoryName: 'Sports',
      })),
    })
  }

  // Languages
  if (camp.activities.includes('languages')) {
    categories.push({
      id: 'languages',
      name: 'Languages',
      activities: PREDEFINED_LANGUAGES.map(lang => ({
        ...lang,
        categoryId: 'languages',
        categoryName: 'Languages',
      })),
    })
  }

  // Arts & Crafts
  if (camp.activities.includes('arts')) {
    categories.push({
      id: 'arts',
      name: 'Arts & Crafts',
      activities: PREDEFINED_ARTS.map(art => ({
        ...art,
        categoryId: 'arts',
        categoryName: 'Arts & Crafts',
      })),
    })
  }

  // Academics
  if (camp.activities.includes('academics')) {
    categories.push({
      id: 'academics',
      name: 'Academics',
      activities: PREDEFINED_ACADEMICS.map(academic => ({
        ...academic,
        categoryId: 'academics',
        categoryName: 'Academics',
      })),
    })
  }

  // Adventure
  if (camp.activities.includes('adventure')) {
    categories.push({
      id: 'adventure',
      name: 'Adventure',
      activities: PREDEFINED_ADVENTURE.map(adventure => ({
        ...adventure,
        categoryId: 'adventure',
        categoryName: 'Adventure',
      })),
    })
  }

  // Water Activities
  if (camp.activities.includes('water')) {
    categories.push({
      id: 'water',
      name: 'Water Activities',
      activities: PREDEFINED_WATER_ACTIVITIES.map(water => ({
        ...water,
        categoryId: 'water',
        categoryName: 'Water Activities',
      })),
    })
  }

  // Environmental
  if (camp.activities.includes('environment')) {
    categories.push({
      id: 'environmental',
      name: 'Environmental',
      activities: PREDEFINED_ENVIRONMENTAL.map(env => ({
        ...env,
        categoryId: 'environmental',
        categoryName: 'Environmental',
      })),
    })
  }

  return categories
}

/**
 * Find an activity by ID across all categories
 */
export function findActivityById(
  categories: ActivityCategory[],
  activityId: string
): ActivityWithCategory | null {
  for (const category of categories) {
    const activity = category.activities.find(a => a.id === activityId)
    if (activity) {
      return activity
    }
  }
  return null
}
