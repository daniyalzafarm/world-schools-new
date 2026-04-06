'use client'

import { useState } from 'react'
import type { Camp, MetaCard } from '../../types/camps'
import { ExpandableText } from './ExpandableText'
import { type ActivitySectionData, AllActivitiesModal } from './AllActivitiesModal'
import {
  getCoachingTypeLabel,
  getSkillLevelLabel,
  getTeachingApproachLabel,
  transformAcademics,
  transformAdventureActivities,
  transformArtsAndCrafts,
  transformEnvironmentalActivities,
  transformExcursionsTrips,
  transformLanguagePrograms,
  transformReligionPrograms,
  transformSportsActivities,
  transformWaterActivities,
} from '../../utils/activity-transformers'
import config from '../../config/config'
import { Button } from '@heroui/react'

const ACTIVITY_CONFIG: Record<
  string,
  {
    title: string
    icon: string
    dataField: string
    transformData: (data: any) => any
    getMetaCards?: (data: any) => MetaCard[]
    getBadges?: (data: any) => string[]
  }
> = {
  sports: {
    title: 'Sports',
    icon: '⚽',
    dataField: 'sportsActivities',
    transformData: transformSportsActivities,
    getMetaCards: getSportsMetaCards,
    getBadges: (d: any) => d.badges || [],
  },
  languages: {
    title: 'Languages',
    icon: '🗣️',
    dataField: 'languagePrograms',
    transformData: transformLanguagePrograms,
  },
  academics: {
    title: 'Academics',
    icon: '📚',
    dataField: 'academics',
    transformData: transformAcademics,
    getMetaCards: getAcademicsMetaCards,
    getBadges: (d: any) => d.badges || [],
  },
  adventure: {
    title: 'Adventure Activities',
    icon: '🧗',
    dataField: 'adventureActivities',
    transformData: transformAdventureActivities,
  },
  arts: {
    title: 'Arts & Crafts',
    icon: '🎨',
    dataField: 'artsAndCrafts',
    transformData: transformArtsAndCrafts,
  },
  water: {
    title: 'Water Activities',
    icon: '🏊',
    dataField: 'waterActivities',
    transformData: transformWaterActivities,
  },
  excursions: {
    title: 'Excursions & Trips',
    icon: '🚌',
    dataField: 'excursionsTrips',
    transformData: transformExcursionsTrips,
  },
  environment: {
    title: 'Environmental Activities',
    icon: '🌱',
    dataField: 'environmentalActivities',
    transformData: transformEnvironmentalActivities,
  },
  environmental: {
    title: 'Environmental Activities',
    icon: '🌱',
    dataField: 'environmentalActivities',
    transformData: transformEnvironmentalActivities,
  },
  religion: {
    title: 'Religion',
    icon: '🕊️',
    dataField: 'religionPrograms',
    transformData: transformReligionPrograms,
  },
}

function getSportsMetaCards(sports: any): MetaCard[] {
  const cards: MetaCard[] = []
  if (sports.skillLevel) {
    const label = getSkillLevelLabel(sports.skillLevel)
    if (label) cards.push({ label: 'Skill Level', value: label })
  }
  if (sports.coachingType) {
    const label = getCoachingTypeLabel(sports.coachingType)
    if (label) cards.push({ label: 'Coaching Type', value: label })
  }
  return cards
}

function getAcademicsMetaCards(academics: any): MetaCard[] {
  const cards: MetaCard[] = []
  if (academics.teachingApproach) {
    const label = getTeachingApproachLabel(academics.teachingApproach)
    if (label) cards.push({ label: 'Teaching Approach', value: label })
  }
  return cards
}

function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const storageUrl = config.app.storageUrl.endsWith('/')
    ? config.app.storageUrl
    : `${config.app.storageUrl}/`
  return `${storageUrl}${url}`
}

function buildSections(camp: Camp): ActivitySectionData[] {
  return (camp.activities ?? []).flatMap(activityType => {
    const cfg = ACTIVITY_CONFIG[activityType]
    if (!cfg) return []
    const data = (camp as any)[cfg.dataField]
    if (!data) return []
    const items = cfg.transformData(data)
    return [
      {
        key: activityType,
        title: cfg.title,
        icon: cfg.icon,
        description: data.description,
        items,
        metaCards: cfg.getMetaCards?.(data),
        badges: cfg.getBadges?.(data),
      } satisfies ActivitySectionData,
    ]
  })
}

const PHOTOS_PER_PAGE = 3

interface CampActivitiesSectionProps {
  camp: Camp
}

export function CampActivitiesSection({ camp }: CampActivitiesSectionProps) {
  const [photoPage, setPhotoPage] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const sections = buildSections(camp)
  const photos = camp.photos ?? []
  const totalPhotoPages = Math.ceil(photos.length / PHOTOS_PER_PAGE)
  const visiblePhotos = photos.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE)

  // Special focus: single primary activity type
  const isSpecialFocus = sections.length === 1
  const primarySection = sections[0]
  const otherSections = sections.slice(1)

  // Description: primary section description (if any)
  const overviewDescription = primarySection?.description

  return (
    <>
      {/* ── Header row: title + photo carousel nav ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Activities</h2>
        {totalPhotoPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {photoPage + 1} / {totalPhotoPages}
            </span>
            <button
              onClick={() => setPhotoPage(p => p - 1)}
              disabled={photoPage === 0}
              aria-label="Previous photos"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => setPhotoPage(p => Math.min(totalPhotoPages - 1, p + 1))}
              disabled={photoPage >= totalPhotoPages - 1}
              aria-label="Next photos"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Photo carousel (desktop: 3-col grid, mobile: horizontal scroll) ── */}
      {photos.length > 0 && (
        <>
          {/* Mobile scroll */}
          <div className="md:hidden -mx-6 mb-5">
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-6 pb-1">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className="shrink-0 rounded-xl overflow-hidden"
                  style={{ width: '60vw' }}
                >
                  <img
                    src={getImageUrl(photo.url)}
                    alt={photo.caption || 'Activity photo'}
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '4 / 3' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Desktop carousel */}
          <div className="hidden md:grid grid-cols-3 gap-4 mb-5">
            {visiblePhotos.map(photo => (
              <div key={photo.id} className="rounded-2xl overflow-hidden bg-gray-100">
                <img
                  src={getImageUrl(photo.url)}
                  alt={photo.caption || 'Activity photo'}
                  className="w-full object-cover"
                  style={{ aspectRatio: '4 / 3' }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Description ── */}
      {overviewDescription && (
        <ExpandableText text={overviewDescription} maxLines={4} className="mb-4" />
      )}

      {/* ── Multi-activity: category summary chips with count ── */}
      {!isSpecialFocus && sections.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {sections.map(section => (
            <span
              key={section.key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[13px] text-gray-700 font-medium"
            >
              <span className="text-sm leading-none">{section.icon}</span>
              {section.title}
              {section.items.length > 0 && (
                <span className="text-gray-400 font-normal">{section.items.length}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Special focus: primary activity pills ── */}
      {isSpecialFocus && primarySection && primarySection.items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {primarySection.items.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-[13.5px] font-semibold text-gray-900 whitespace-nowrap"
            >
              {item.icon && item.icon !== '✨' && (
                <span className="text-base leading-none" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Special focus: "other included activities" ── */}
      {isSpecialFocus && otherSections.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Other included activities
          </p>
          <OtherActivitiesChips sections={otherSections} />
        </div>
      )}

      {/* ── See full programme button ── */}
      <Button
        onPress={() => setIsModalOpen(true)}
        variant="flat"
        className="w-full md:w-auto md:px-6 rounded-xl border border-primary/30 text-sm font-semibold text-secondary bg-primary/10 hover:bg-primary/20"
      >
        See full programme
      </Button>

      {/* ── Modal ── */}
      <AllActivitiesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sections={sections}
      />
    </>
  )
}

/** Compact flat list of activity items across multiple sections, with "+N more" overflow */
function OtherActivitiesChips({ sections }: { sections: ActivitySectionData[] }) {
  const allItems = sections.flatMap(s => s.items)
  const MAX_VISIBLE = 4
  const visible = allItems.slice(0, MAX_VISIBLE)
  const remaining = allItems.length - MAX_VISIBLE

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(item => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[13px] text-gray-700 font-medium whitespace-nowrap"
        >
          {item.icon && item.icon !== '✨' && (
            <span className="text-sm leading-none">{item.icon}</span>
          )}
          {item.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-[13px] text-gray-500 font-medium whitespace-nowrap">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
