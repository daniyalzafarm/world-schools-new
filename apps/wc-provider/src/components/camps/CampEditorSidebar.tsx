'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Tooltip } from '@heroui/react'
import { Lock } from 'lucide-react'
import { useCampsStore } from '../../stores/camps-store'
import { useSessionsStore } from '../../stores/sessions-store'
import { Logo } from '@/components/layout/logo'
import { getCampEligibility } from '../../services/camps.services'
import { getCampAddOns } from '../../services/camp-addons.service'
import {
  computeCampProgressPercent,
  type EditorSection,
  editorSections,
  getSectionProgress,
  getUnmetPrerequisites,
  shouldShowSection,
} from './editor-sections'
import { CountBadge } from './CountBadge'

interface CampEditorSidebarProps {
  campId: string
}

// "Basic Info", "Basic Info and Audience", "Basic Info, Audience and Programs"
function formatPrerequisiteNames(sections: EditorSection[]): string {
  const names = sections.map(s => s.label)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
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

  useEffect(() => {
    if (sessionsCampId !== campId) {
      void loadSessions(campId)
    }
  }, [campId, sessionsCampId, loadSessions])

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

  const progressPercent = computeCampProgressPercent(
    currentCamp,
    sidebarEligibilityCount,
    sidebarAddonEnabledCount,
    sidebarAddonTotalCount,
    sessionCounts
  )

  const categories: string[] = Array.from(
    new Set(editorSections.map(s => s.category).filter((c): c is string => !!c))
  )

  const getSectionsByCategory = (category: string) => {
    return editorSections.filter(s => s.category === category && shouldShowSection(s, currentCamp))
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
                const unmetPrerequisites = getUnmetPrerequisites(
                  section.id,
                  currentCamp,
                  sidebarEligibilityCount,
                  sidebarAddonEnabledCount,
                  sidebarAddonTotalCount,
                  sessionCounts
                )
                const isLocked = unmetPrerequisites.length > 0

                if (isLocked) {
                  return (
                    <Tooltip
                      key={section.id}
                      placement="top"
                      showArrow
                      content={`Complete ${formatPrerequisiteNames(unmetPrerequisites)} first`}
                    >
                      <div className="relative flex w-full cursor-not-allowed items-center gap-3 px-5 py-2.5 text-left text-sm font-medium text-default-400 opacity-60">
                        <span className="flex-1 truncate">{section.label}</span>
                        <Lock className="size-3.5 shrink-0 text-default-400" />
                      </div>
                    </Tooltip>
                  )
                }

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
                    {!section.excludeFromProgress && <CountBadge progress={progress} />}
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
