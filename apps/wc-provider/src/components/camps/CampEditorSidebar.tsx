'use client'

import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCampsStore } from '../../stores/camps-store'

interface EditorSection {
  id: string
  label: string
  path: string
  category?: string
}

const editorSections: EditorSection[] = [
  { id: 'basic-info', label: 'Basic Information', path: 'basic-info' },
  { id: 'photos', label: 'Photos', path: 'photos' },
  { id: 'whats-included', label: "What's Included", path: 'whats-included' },
  { id: 'daily-schedule', label: 'Daily Schedule', path: 'daily-schedule' },
  { id: 'meals', label: 'Meals', path: 'meals' },
  { id: 'sports', label: 'Sports', path: 'sports', category: 'Activities' },
  { id: 'languages', label: 'Languages', path: 'languages', category: 'Activities' },
  { id: 'arts', label: 'Arts & Crafts', path: 'arts', category: 'Activities' },
  { id: 'adventure', label: 'Adventure', path: 'adventure', category: 'Activities' },
  { id: 'water', label: 'Water Activities', path: 'water', category: 'Activities' },
  { id: 'environmental', label: 'Environmental', path: 'environmental', category: 'Activities' },
  { id: 'academics', label: 'Academics', path: 'academics', category: 'Activities' },
  { id: 'religion', label: 'Religion', path: 'religion', category: 'Activities' },
  { id: 'excursions', label: 'Excursions', path: 'excursions' },
  { id: 'location-campus', label: 'Location & Campus', path: 'location-campus' },
  { id: 'accommodation', label: 'Accommodation', path: 'accommodation' },
  { id: 'getting-there', label: 'Getting There', path: 'getting-there' },
  { id: 'camp-focus', label: 'Camp Focus', path: 'camp-focus' },
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

  // Group sections by category
  const generalSections = editorSections.filter(s => !s.category)
  const activitySections = editorSections.filter(s => s.category === 'Activities')

  // Filter residential-only sections
  const shouldShowSection = (section: EditorSection) => {
    if (section.id === 'accommodation' || section.id === 'getting-there') {
      return currentCamp?.type === 'residential'
    }
    return true
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[280px] border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-18 items-center border-b border-gray-200 px-6">
        <Image src="/images/logo.svg" alt="World-Camps" width={140} height={32} priority />
      </div>

      {/* Camp Name */}
      <div className="border-b border-gray-200 px-6 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Editing Camp</p>
        <h2 className="mt-1 truncate text-sm font-semibold text-gray-900">
          {currentCamp?.name || 'Loading...'}
        </h2>
      </div>

      {/* Sections List */}
      <nav className="overflow-y-auto px-3 py-4" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="space-y-1">
          {/* General Sections */}
          {generalSections.filter(shouldShowSection).map(section => (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isActive(section)
                  ? 'bg-primary-50 font-medium text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {section.label}
            </button>
          ))}

          {/* Activities Category */}
          <div className="pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Activities
            </p>
            {activitySections.map(section => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive(section)
                    ? 'bg-primary-50 font-medium text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  )
}
