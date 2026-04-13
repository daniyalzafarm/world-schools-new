'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCampsStore } from '../../stores/camps-store'
import { Logo } from '@/components/layout/logo'

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

interface CampEditorSidebarProps {
  campId: string
}

export function CampEditorSidebar({ campId }: CampEditorSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentCamp } = useCampsStore()

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

  // Group sections by category
  const categories: any = Array.from(new Set(editorSections.map(s => s.category).filter(Boolean)))

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

      {/* Sections List - Scrollable */}
      <nav className="flex-1 overflow-y-auto py-6">
        {categories.map((category, categoryIndex) => {
          const sections = getSectionsByCategory(category)
          if (sections.length === 0) return null

          return (
            <div key={category} className={categoryIndex > 0 ? 'mt-6' : ''}>
              <div className="mb-3 px-5 text-xs font-bold uppercase tracking-[0.5px] text-default-500">
                {category}
              </div>
              {sections.map(section => {
                const isCurrent = isActive(section)

                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`cursor-pointer relative flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-all ${
                      isCurrent
                        ? 'bg-white font-semibold text-foreground'
                        : 'font-medium text-foreground hover:bg-white/60'
                    }`}
                  >
                    {/* Active Indicator */}
                    {isCurrent && <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />}
                    <span>{section.label}</span>
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
