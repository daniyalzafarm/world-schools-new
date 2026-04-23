'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCampsStore } from '../../stores/camps-store'
import { useSessionsStore } from '../../stores/sessions-store'
import { Logo } from '@/components/layout/logo'
import { getCampEligibility } from '../../services/camps.services'
import { getCampAddOns } from '../../services/camp-addons.service'
import type { Camp } from '../../types/camps'

interface EditorSection {
  id: string
  label: string
  path: string
  category?: string
  activityKey?: string // Maps to the activity value in camp.activities array
}

const editorSections: EditorSection[] = [
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
  { id: 'sessions', label: 'Sessions', path: 'sessions', category: 'SESSIONS & BOOKING' },
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
]

interface SectionProgress {
  completed: number
  total: number
}

type SectionStatus = 'empty' | 'partial' | 'complete'

function getStatus({ completed, total }: SectionProgress): SectionStatus {
  if (total === 0 || completed === 0) return 'empty'
  if (completed >= total) return 'complete'
  return 'partial'
}

function hasText(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function activityProgress(
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

function getSectionProgress(
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

function CountBadge({ progress }: { progress: SectionProgress }) {
  const status = getStatus(progress)
  // Binary sections (total = 1) show "Add"/"Done" instead of a count
  const label =
    progress.total === 1
      ? progress.completed === 0
        ? 'Add'
        : 'Done'
      : `${progress.completed}/${progress.total}`

  const colorClasses =
    status === 'complete'
      ? 'bg-success-100 text-success-700'
      : status === 'partial'
        ? 'bg-warning-100 text-warning-800'
        : 'bg-danger-100 text-danger-700'

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorClasses}`}
    >
      {label}
    </span>
  )
}

interface CampEditorSidebarProps {
  campId: string
}

export function CampEditorSidebar({ campId }: CampEditorSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentCamp, sidebarEligibilityCount, sidebarAddonEnabledCount, sidebarAddonTotalCount } =
    useCampsStore()
  const sessions = useSessionsStore(state => state.sessions)
  const sessionsCampId = useSessionsStore(state => state.currentCampId)
  const loadSessions = useSessionsStore(state => state.loadSessions)
  const sessionCounts =
    sessionsCampId === campId
      ? {
          published: sessions.filter(s => s.status === 'published').length,
          total: sessions.length,
        }
      : null

  // Load sessions for this camp if the sessions store is empty or pointing elsewhere
  useEffect(() => {
    if (sessionsCampId !== campId) {
      void loadSessions(campId)
    }
  }, [campId, sessionsCampId, loadSessions])

  // Fetch eligibility and addon counts once on mount if not yet loaded
  useEffect(() => {
    if (sidebarEligibilityCount === null) {
      getCampEligibility(campId)
        .then(res => {
          const count = res.success ? (res.data.items?.length ?? 0) : 0
          useCampsStore.setState({ sidebarEligibilityCount: count })
        })
        .catch(() => {
          useCampsStore.setState({ sidebarEligibilityCount: 0 })
        })
    }
    if (sidebarAddonTotalCount === null) {
      getCampAddOns(campId)
        .then(res => {
          if (res.success) {
            const addOns = res.data.addOns
            useCampsStore.setState({
              sidebarAddonEnabledCount: addOns.filter(a => a.isEnabled).length,
              sidebarAddonTotalCount: addOns.length,
            })
          } else {
            useCampsStore.setState({
              sidebarAddonEnabledCount: 0,
              sidebarAddonTotalCount: 0,
            })
          }
        })
        .catch(() => {
          useCampsStore.setState({
            sidebarAddonEnabledCount: 0,
            sidebarAddonTotalCount: 0,
          })
        })
    }
  }, [campId, sidebarEligibilityCount, sidebarAddonTotalCount])

  const handleSectionClick = (section: EditorSection) => {
    router.push(`/camps/${campId}/edit/${section.path}`)
  }

  const isActive = (section: EditorSection) => {
    return pathname.includes(section.path)
  }

  // Filter sections based on camp configuration
  const shouldShowSection = (section: EditorSection) => {
    // Filter residential-only sections
    if (section.id === 'accommodation' || section.id === 'getting-there') {
      if (currentCamp?.type !== 'residential') return false
    }

    // Filter activity sections based on selected activities
    if (section.activityKey) {
      const selectedActivities = currentCamp?.activities ?? []
      return selectedActivities.includes(section.activityKey)
    }

    return true
  }

  // Compute overall progress from summed field counts
  const visibleSections = editorSections.filter(shouldShowSection)
  const { totalCompleted, totalFields } = visibleSections.reduce(
    (acc, s) => {
      const p = getSectionProgress(
        s.id,
        currentCamp,
        sidebarEligibilityCount,
        sidebarAddonEnabledCount,
        sidebarAddonTotalCount,
        sessionCounts
      )
      return {
        totalCompleted: acc.totalCompleted + p.completed,
        totalFields: acc.totalFields + p.total,
      }
    },
    { totalCompleted: 0, totalFields: 0 }
  )
  const progressPercent = totalFields > 0 ? Math.round((totalCompleted / totalFields) * 100) : 0

  // Group sections by category
  const categories: string[] = Array.from(
    new Set(editorSections.map(s => s.category).filter((c): c is string => !!c))
  )

  const getSectionsByCategory = (category: string) => {
    return editorSections.filter(s => s.category === category && shouldShowSection(s))
  }

  return (
    <aside className="fixed left-0 top-0 z-100 flex h-screen w-72 flex-col border-r border-default-200 bg-default-50">
      {/* Logo Header - Fixed */}
      <div className="flex min-h-16 shrink-0 items-center bg-default-50 px-5 py-5">
        <Logo />
      </div>

      {/* Camp Name - Fixed */}
      <div className="shrink-0 border-b border-default-200 bg-default-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.5px] text-default-500">
          EDITING CAMP
        </p>
        <h2 className="mt-1 truncate text-sm font-semibold text-foreground">
          {currentCamp?.name || 'Loading...'}
        </h2>
      </div>

      {/* Progress Card */}
      <div className="mx-4 my-3 shrink-0 rounded-xl border border-default-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-default-500">
            Profile Completion
          </span>
          <span className="text-sm font-bold text-primary-700">{progressPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-default-200">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Sections List - Scrollable */}
      <nav className="flex-1 overflow-y-auto py-2">
        {categories.map((category, categoryIndex) => {
          const sections = getSectionsByCategory(category)
          if (sections.length === 0) return null

          return (
            <div key={category} className={categoryIndex > 0 ? 'mt-4' : ''}>
              <div className="mb-1 px-5 text-xs font-bold uppercase tracking-[0.5px] text-default-500">
                {category}
              </div>
              {sections.map(section => {
                const isCurrent = isActive(section)
                const progress = getSectionProgress(
                  section.id,
                  currentCamp,
                  sidebarEligibilityCount,
                  sidebarAddonEnabledCount,
                  sidebarAddonTotalCount,
                  sessionCounts
                )

                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`relative flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left text-sm transition-all ${
                      isCurrent
                        ? 'bg-white font-semibold text-foreground'
                        : 'font-medium text-foreground hover:bg-white/60'
                    }`}
                  >
                    {/* Active Indicator */}
                    {isCurrent && <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />}
                    <span className="flex-1 truncate">{section.label}</span>
                    <CountBadge progress={progress} />
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
