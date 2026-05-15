import type { Camp } from '../../types/camps'

export interface EditorSection {
  id: string
  label: string
  path: string
  category?: string
  activityKey?: string
  navigationOnly?: boolean
  hideFooterNav?: boolean
  excludeFromProgress?: boolean
}

export const editorSections: EditorSection[] = [
  // CAMP OVERVIEW
  { id: 'basic-info', label: 'Basic Info', path: 'basic-info', category: 'CAMP OVERVIEW' },
  { id: 'audience', label: 'Audience', path: 'audience', category: 'CAMP OVERVIEW' },
  { id: 'photos', label: 'Photos & Media', path: 'photos', category: 'CAMP OVERVIEW' },

  // PROGRAM & ACTIVITIES
  { id: 'camp-focus', label: 'Camp Focus', path: 'camp-focus', category: 'PROGRAM & ACTIVITIES' },
  { id: 'programs', label: 'Programs', path: 'programs', category: 'PROGRAM & ACTIVITIES' },
  {
    id: 'sports',
    label: 'Sports',
    path: 'sports',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'sports',
  },
  {
    id: 'languages',
    label: 'Languages',
    path: 'languages',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'languages',
  },
  {
    id: 'arts',
    label: 'Arts & Creativity',
    path: 'arts',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'arts',
  },
  {
    id: 'adventure',
    label: 'Adventure & Outdoors',
    path: 'adventure',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'adventure',
  },
  {
    id: 'water',
    label: 'Water Activities',
    path: 'water',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'water',
  },
  {
    id: 'environmental',
    label: 'Nature & Environment',
    path: 'environmental',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'environment',
  },
  {
    id: 'academics',
    label: 'Academics',
    path: 'academics',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'academics',
  },
  {
    id: 'religion',
    label: 'Religion Programs',
    path: 'religion',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'religion',
  },
  {
    id: 'excursions',
    label: 'Excursions & Trips',
    path: 'excursions',
    category: 'PROGRAM & ACTIVITIES',
    activityKey: 'excursions',
  },

  // SESSIONS & BOOKING
  {
    id: 'sessions',
    label: 'Sessions',
    path: 'sessions',
    category: 'SESSIONS & BOOKING',
    navigationOnly: true,
  },
  {
    id: 'whats-included',
    label: "What's Included",
    path: 'whats-included',
    category: 'SESSIONS & BOOKING',
  },
  { id: 'addons', label: 'Optional Add-ons', path: 'addons', category: 'SESSIONS & BOOKING' },

  // ELIGIBILITY & BOOKING
  {
    id: 'skill-requirements',
    label: 'Skills & Levels Required',
    path: 'skill-requirements',
    category: 'ELIGIBILITY & BOOKING',
  },

  // ACCOMMODATION & CARE
  {
    id: 'accommodation',
    label: 'Accommodation',
    path: 'accommodation',
    category: 'ACCOMMODATION & CARE',
  },
  { id: 'meals', label: 'Meals & Dietary', path: 'meals', category: 'ACCOMMODATION & CARE' },
  {
    id: 'daily-schedule',
    label: 'Daily Schedule',
    path: 'daily-schedule',
    category: 'ACCOMMODATION & CARE',
  },

  // SAFETY & POLICIES
  {
    id: 'safety-policies',
    label: 'Safety & Policies',
    path: 'safety-policies',
    category: 'SAFETY & POLICIES',
  },

  // LOCATION & LOGISTICS
  {
    id: 'location-campus',
    label: 'Location & Campus',
    path: 'location-campus',
    category: 'LOCATION & LOGISTICS',
  },
  {
    id: 'getting-there',
    label: 'Getting There',
    path: 'getting-there',
    category: 'LOCATION & LOGISTICS',
  },

  // REVIEW & PUBLISH
  {
    id: 'review',
    label: 'Review & Publish',
    path: 'review',
    category: 'REVIEW & PUBLISH',
    navigationOnly: true,
    hideFooterNav: true,
    excludeFromProgress: true,
  },
]

export const navigationOnlySections: string[] = editorSections
  .filter(s => s.navigationOnly)
  .map(s => s.id)

export interface SectionProgress {
  completed: number
  total: number
}

export type SectionStatus = 'empty' | 'partial' | 'complete'

export function getStatus({ completed, total }: SectionProgress): SectionStatus {
  if (total === 0 || completed === 0) return 'empty'
  if (completed >= total) return 'complete'
  return 'partial'
}

export function hasText(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function activityProgress(
  activity: Record<string, unknown> | undefined,
  selectedFieldNames: string[]
): SectionProgress {
  let c = 0
  const hasAnySelected = selectedFieldNames.some(name => {
    const v = activity?.[name]
    return Array.isArray(v) && v.length > 0
  })
  if (hasAnySelected) c++
  if (hasText(activity?.description as string | undefined)) c++
  return { completed: c, total: 2 }
}

export function shouldShowSection(section: EditorSection, camp: Camp | null): boolean {
  if (section.id === 'accommodation' || section.id === 'getting-there') {
    if (camp?.type !== 'residential') return false
  }

  if (section.activityKey) {
    const selectedActivities = camp?.activities ?? []
    return selectedActivities.includes(section.activityKey)
  }

  return true
}

export function getSectionProgress(
  sectionId: string,
  camp: Camp | null,
  eligibilityCount: number | null,
  addonEnabledCount: number | null,
  addonTotalCount: number | null,
  sessionCounts: { published: number; total: number } | null
): SectionProgress {
  if (!camp) return { completed: 0, total: 1 }

  switch (sectionId) {
    case 'basic-info': {
      let c = 0
      if (hasText(camp.name)) c++
      if (hasText(camp.slug)) c++
      if (hasText(camp.description)) c++
      if (camp.type) c++
      if (
        camp.locationType === 'provider' ||
        (camp.locationType === 'different' && !!camp.locationPlaceId)
      )
        c++
      return { completed: c, total: 5 }
    }
    case 'audience': {
      let c = 0
      if ((camp.ageGroups?.length ?? 0) > 0) c++
      if ((camp.languages?.length ?? 0) > 0) c++
      if (camp.gender) c++
      return { completed: c, total: 3 }
    }
    case 'programs':
      return { completed: (camp.activities?.length ?? 0) > 0 ? 1 : 0, total: 1 }
    case 'photos': {
      const count = Math.min(camp.photos?.length ?? 0, 5)
      return { completed: count, total: 5 }
    }
    case 'camp-focus': {
      let c = 0
      if (camp.campFocus?.primaryFocus) c++
      if (hasText(camp.campFocus?.description)) c++
      if (hasText(camp.campFocus?.philosophy)) c++
      if (hasText(camp.campFocus?.learningApproach)) c++
      return { completed: c, total: 4 }
    }
    case 'sessions': {
      if (!sessionCounts || sessionCounts.total === 0) return { completed: 0, total: 1 }
      return { completed: sessionCounts.published, total: sessionCounts.total }
    }
    case 'whats-included': {
      const raw = camp.whatsIncluded as any
      const autoSelected = Array.isArray(raw?.autoGenerated)
        ? raw.autoGenerated.filter((i: any) => i?.isSelected).length
        : 0
      const manualSelected = Array.isArray(raw?.manual)
        ? raw.manual.filter((i: any) => i?.isSelected).length
        : 0
      return { completed: autoSelected + manualSelected > 0 ? 1 : 0, total: 1 }
    }
    case 'addons': {
      if (addonTotalCount === null) return { completed: 0, total: 1 }
      if (addonTotalCount === 0) return { completed: 0, total: 1 }
      return { completed: addonEnabledCount ?? 0, total: addonTotalCount }
    }
    case 'skill-requirements':
      return { completed: (eligibilityCount ?? 0) > 0 ? 1 : 0, total: 1 }
    case 'accommodation': {
      const a = camp.accommodation as any
      let c = 0
      if (hasText(a?.description)) c++
      if (hasText(a?.roomCapacity)) c++
      if (hasText(a?.supervision)) c++
      if ((a?.selectedTypes?.length ?? 0) > 0) c++
      if ((a?.amenities?.length ?? 0) > 0) c++
      return { completed: c, total: 5 }
    }
    case 'meals': {
      const m = camp.meals as any
      let c = 0
      if (hasText(m?.description)) c++
      if ((m?.mealTypes?.length ?? 0) > 0) c++
      if (hasText(m?.mealStyle)) c++
      if ((m?.dietaryOptions?.length ?? 0) > 0) c++
      return { completed: c, total: 4 }
    }
    case 'daily-schedule': {
      const d = camp as any
      let c = 0
      if (d.scheduleType) c++
      const slotsFilled =
        d.scheduleType === 'weekly'
          ? Object.values(d.weeklySchedule ?? {}).some(
              (day: any) => Array.isArray(day?.timeSlots) && day.timeSlots.length > 0
            )
          : Array.isArray(d.dailySchedule?.timeSlots) && d.dailySchedule.timeSlots.length > 0
      if (slotsFilled) c++
      return { completed: c, total: 2 }
    }
    case 'safety-policies': {
      const s = camp.safetySupervision as any
      const p = camp.screenPolicy as any
      let c = 0
      if (hasText(s?.description)) c++
      if ((s?.staffRatios?.length ?? 0) > 0) c++
      if ((s?.items?.length ?? 0) > 0) c++
      if (hasText(p?.description)) c++
      return { completed: c, total: 4 }
    }
    case 'location-campus': {
      const l = camp.campusFacilities as any
      let c = 0
      if (hasText(l?.description)) c++
      if (hasText(l?.campusSize)) c++
      if (hasText(l?.campusSetting)) c++
      if ((l?.selectedFacilities?.length ?? 0) > 0) c++
      return { completed: c, total: 4 }
    }
    case 'getting-there': {
      const g = camp.gettingThere as any
      let c = 0
      if (hasText(g?.description)) c++
      if (hasText(g?.transportIncluded)) c++
      if (hasText(g?.pickupLocations)) c++
      if ((g?.selectedTransport?.length ?? 0) > 0) c++
      return { completed: c, total: 4 }
    }
    case 'sports':
      return activityProgress(camp.sportsActivities as Record<string, unknown> | undefined, [
        'selectedSports',
        'customSports',
      ])
    case 'languages':
      return activityProgress(camp.languagePrograms as Record<string, unknown> | undefined, [
        'selectedLanguages',
        'customLanguages',
      ])
    case 'arts':
      return activityProgress(camp.artsAndCrafts as Record<string, unknown> | undefined, [
        'selectedArts',
        'customArts',
      ])
    case 'adventure':
      return activityProgress(camp.adventureActivities as Record<string, unknown> | undefined, [
        'selectedActivities',
        'customActivities',
      ])
    case 'water':
      return activityProgress(camp.waterActivities as Record<string, unknown> | undefined, [
        'selectedActivities',
        'customActivities',
      ])
    case 'environmental':
      return activityProgress(camp.environmentalActivities as Record<string, unknown> | undefined, [
        'selectedActivities',
        'customActivities',
      ])
    case 'academics':
      return activityProgress(camp.academics as Record<string, unknown> | undefined, [
        'selectedSubjects',
        'customSubjects',
      ])
    case 'religion':
      return activityProgress(camp.religionPrograms as Record<string, unknown> | undefined, [
        'selectedPrograms',
        'customPrograms',
      ])
    case 'excursions':
      return activityProgress(camp.excursionsTrips as Record<string, unknown> | undefined, [
        'selectedTrips',
        'customTrips',
      ])
    default:
      return { completed: 0, total: 1 }
  }
}

export function computeCampProgressPercent(
  camp: Camp | null,
  eligibilityCount: number | null,
  addonEnabledCount: number | null,
  addonTotalCount: number | null,
  sessionCounts: { published: number; total: number } | null
): number {
  if (!camp) return 0
  const visibleSections = editorSections
    .filter(s => shouldShowSection(s, camp))
    .filter(s => !s.excludeFromProgress)
  const { totalCompleted, totalFields } = visibleSections.reduce(
    (acc, s) => {
      const p = getSectionProgress(
        s.id,
        camp,
        eligibilityCount,
        addonEnabledCount,
        addonTotalCount,
        sessionCounts
      )
      return {
        totalCompleted: acc.totalCompleted + p.completed,
        totalFields: acc.totalFields + p.total,
      }
    },
    { totalCompleted: 0, totalFields: 0 }
  )
  return totalFields > 0 ? Math.round((totalCompleted / totalFields) * 100) : 0
}
