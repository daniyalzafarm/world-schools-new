'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCampBySlug } from '@/services/camps.services'
import type { Camp } from '@/types/camps'
import config from '@/config/config'
import { InnerPageNav } from '@/components/camp/InnerPageNav'
import { SectionHeader, SectionSubheader } from '@/components/camp/SectionHeader'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { ActivityGrid } from '@/components/camp/ActivityGrid'
import { IncludedGrid } from '@/components/camp/IncludedGrid'
import { DailySchedule } from '@/components/camp/DailySchedule'
import { SafetyCard } from '@/components/camp/SafetyCard'

export default function CampPage() {
  const params = useParams()
  const router = useRouter()
  const campSlug = params.campSlug as string

  const [camp, setCamp] = useState<Camp | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCamp = async () => {
      try {
        setIsLoading(true)
        const campData = await getCampBySlug(campSlug)
        setCamp(campData)
      } catch (err: any) {
        console.error('Failed to fetch camp:', err)
        setError(err.message || 'Failed to load camp')
      } finally {
        setIsLoading(false)
      }
    }

    if (campSlug) {
      fetchCamp().catch(error => {
        console.error('Failed to fetch camp:', error)
      })
    }
  }, [campSlug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading camp details...</p>
        </div>
      </div>
    )
  }

  if (error || !camp) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Camp Not Found</h1>
          <p className="text-gray-600">{error || 'The camp you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-[#45F0B5] text-[#222222] rounded-lg font-semibold hover:bg-[#3de0a5] transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const getAgeRangeText = () => {
    if (!camp.ageGroups || camp.ageGroups.length === 0) return 'All ages'
    const minAge = Math.min(...camp.ageGroups.map(ag => ag.min))
    const maxAge = Math.max(...camp.ageGroups.map(ag => ag.max))
    return `Ages ${minAge}-${maxAge}`
  }

  const getImageUrl = (url: string) => {
    if (!url) return ''
    // If URL is already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // Otherwise, prepend the storage URL
    const storageUrl = config.app.storageUrl.endsWith('/')
      ? config.app.storageUrl
      : `${config.app.storageUrl}/`
    return `${storageUrl}${url}`
  }

  const primaryPhoto = camp.photos?.find(p => p.isPrimary)?.url || camp.photos?.[0]?.url
  const primaryPhotoUrl = primaryPhoto ? getImageUrl(primaryPhoto) : null

  // Navigation links - dynamically build based on available data
  const navLinks = [
    { href: '#photos', label: 'Photos' },
    { href: '#about', label: 'About' },
    camp.activities && camp.activities.length > 0
      ? { href: '#activities', label: 'Activities' }
      : null,
    camp.dailySchedule ? { href: '#schedule', label: 'Schedule' } : null,
    camp.safetySupervision ? { href: '#safety', label: 'Safety' } : null,
    camp.locationCampus || camp.gettingThere ? { href: '#location', label: 'Location' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <div className="min-h-screen bg-white">
      {/* Inner Page Navigation */}
      <InnerPageNav links={navLinks} />

      {/* Hero Section */}
      <div id="photos">
        {/* Mobile Hero Image */}
        <div className="block lg:hidden relative w-full h-[380px] bg-gray-200">
          <img
            src={primaryPhotoUrl || '/placeholder-camp.jpg'}
            alt={camp.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-4 right-4 bg-black/75 text-white px-3 py-1.5 rounded-2xl text-xs font-medium">
            1/{camp.photos?.length ?? 1}
          </div>
        </div>

        {/* Desktop Hero Grid */}
        <div className="hidden lg:block max-w-[1760px] mx-auto px-20 xl:px-[120px] mt-6 mb-10">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[480px] rounded-xl overflow-hidden relative">
            <div className="col-span-2 row-span-2 bg-gray-200">
              <img
                src={primaryPhotoUrl || '/placeholder-camp.jpg'}
                alt={camp.name}
                className="w-full h-full object-cover"
              />
            </div>
            {camp.photos?.slice(1, 5).map((photo, index) => (
              <div key={photo.id} className="bg-gray-200">
                <img
                  src={getImageUrl(photo.url)}
                  alt={`${camp.name} ${index + 2}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {(!camp.photos || camp.photos.length < 5) &&
              Array.from({ length: 5 - (camp.photos?.length ?? 1) }).map((_, i) => (
                <div
                  key={`placeholder-${i}`}
                  className="bg-gray-200 flex items-center justify-center text-gray-400 text-sm"
                >
                  Image {(camp.photos?.length ?? 1) + i + 1}
                </div>
              ))}
            <button className="absolute bottom-5 right-5 bg-white text-[#222222] px-4 py-2.5 rounded-lg border border-[#222222] text-sm font-semibold flex items-center gap-2 hover:bg-[#F7F7F7] transition-colors">
              <span>🖼️</span>
              <span>Show all photos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Wrapper */}
      <div className="max-w-[1760px] mx-auto px-5 md:px-20 lg:px-[120px] pb-20 lg:pb-20">
        <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-[100px]">
          {/* Main Content */}
          <div className="min-w-0">
            <CampContent camp={camp} getAgeRangeText={getAgeRangeText} />
          </div>

          {/* Booking Sidebar - Desktop Only */}
          <div className="hidden lg:block">
            <BookingSidebar camp={camp} />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#DDDDDD] px-5 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] z-40">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-[#717171]">From</span>
              <span className="text-[22px] font-bold text-[#222222]">€830</span>
              <span className="text-sm text-[#717171]">/week</span>
            </div>
            <span className="text-[13px] text-[#717171]">Jun 15 - Aug 20</span>
          </div>
          <button className="px-8 py-3.5 bg-[#45F0B5] text-[#222222] rounded-[10px] text-base font-semibold hover:bg-[#3de0a5] transition-colors whitespace-nowrap">
            Reserve
          </button>
        </div>
      </div>
    </div>
  )
}

// Camp Content Component
function CampContent({ camp, getAgeRangeText }: { camp: Camp; getAgeRangeText: () => string }) {
  return (
    <>
      {/* Camp Header */}
      <div id="about" className="mb-8 pt-6">
        <h1 className="text-[28px] md:text-[32px] font-bold text-[#222222] mb-3">{camp.name}</h1>

        <div className="flex flex-wrap items-center gap-3 text-[15px] text-[#717171] mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px]">⭐</span>
            <span className="font-semibold text-[#222222]">4.9</span>
            <span>(127 reviews)</span>
          </div>
          <span>•</span>
          <span>{camp.locationName || 'Location TBD'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[14px]">
          <span className="px-3 py-1.5 bg-[#F7F7F7] rounded-full font-medium text-[#222222]">
            {getAgeRangeText()}
          </span>
          <span className="px-3 py-1.5 bg-[#F7F7F7] rounded-full font-medium text-[#222222]">
            {camp.type === 'day' ? 'Day Camp' : 'Sleepaway Camp'}
          </span>
        </div>
      </div>

      {/* About This Camp */}
      <div className="mb-12 pb-8 border-b border-[#DDDDDD]">
        <SectionHeader title="About This Camp" className="mb-4" />
        {camp.description && <ExpandableText text={camp.description} maxLines={4} />}
      </div>

      {/* What's Included */}
      {camp.whatsIncluded && (
        <div id="included" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="What's Included" icon="✓" className="mb-6" />
          <IncludedGrid items={camp.whatsIncluded.items || []} />
        </div>
      )}

      {/* Activities Section */}
      <div id="activities" className="mb-12 pb-8 border-b border-[#DDDDDD]">
        <SectionHeader title="Activities" className="mb-6" />
        <ActivitySections camp={camp} />
      </div>

      {/* Daily Schedule */}
      {camp.dailySchedule?.items && (
        <div id="schedule" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Daily Schedule" icon="📅" className="mb-6" />
          {camp.dailySchedule.description && (
            <p className="text-[15px] text-[#717171] mb-6">{camp.dailySchedule.description}</p>
          )}
          <DailySchedule schedule={camp.dailySchedule.items} />
        </div>
      )}

      {/* Meals */}
      {camp.meals && (
        <div id="meals" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Meals" icon="🍽️" className="mb-6" />
          {camp.meals.description && (
            <p className="text-[15px] text-[#717171] mb-6">{camp.meals.description}</p>
          )}
          {camp.meals.items && camp.meals.items.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {camp.meals.items.map((meal: any, index: number) => (
                <div key={index} className="bg-[#F7F7F7] rounded-xl p-4">
                  <div className="text-[24px] mb-2">{meal.icon}</div>
                  <div className="text-[16px] font-semibold text-[#222222]">{meal.name}</div>
                  {meal.description && (
                    <div className="text-[14px] text-[#717171] mt-1">{meal.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Screen Time Policy */}
      {camp.screenPolicy && (
        <div id="screen-policy" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Screen Time Policy" icon="📱" className="mb-6" />
          {camp.screenPolicy.description && (
            <p className="text-[15px] text-[#222222]">{camp.screenPolicy.description}</p>
          )}
        </div>
      )}

      {/* Safety & Supervision */}
      {camp.safetySupervision && (
        <div id="safety" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Safety & Supervision" icon="🛡️" className="mb-6" />
          {camp.safetySupervision.description && (
            <p className="text-[15px] text-[#717171] mb-6">{camp.safetySupervision.description}</p>
          )}
          <SafetyCard ratios={camp.safetySupervision.ratios} items={camp.safetySupervision.items} />
        </div>
      )}

      {/* Location & Getting There */}
      {(camp.locationCampus || camp.gettingThere) && (
        <div id="location" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Location & Getting There" icon="📍" className="mb-6" />

          {camp.locationCampus?.description && (
            <div className="mb-6">
              <SectionSubheader title="Campus" className="mb-3" />
              <p className="text-[15px] text-[#717171]">{camp.locationCampus.description}</p>
            </div>
          )}

          {camp.gettingThere?.options && (
            <div>
              <SectionSubheader title="Getting There" className="mb-3" />
              <div className="space-y-3">
                {camp.gettingThere.options.map((option: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-[#F7F7F7] rounded-xl">
                    <span className="text-[24px]">{option.icon}</span>
                    <div className="flex-1">
                      <div className="text-[16px] font-semibold text-[#222222] mb-1">
                        {option.name}
                      </div>
                      {option.description && (
                        <div className="text-[14px] text-[#717171]">{option.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accommodation */}
      {camp.accommodation && camp.type === 'residential' && (
        <div id="accommodation" className="mb-12 pb-8 border-b border-[#DDDDDD]">
          <SectionHeader title="Accommodation" icon="🏠" className="mb-6" />
          {camp.accommodation.description && (
            <p className="text-[15px] text-[#717171] mb-6">{camp.accommodation.description}</p>
          )}
          {camp.accommodation.items && camp.accommodation.items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {camp.accommodation.items.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-[#45F0B5] text-[18px] font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-[15px] text-[#222222]">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coming Soon Notice */}
      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Booking Coming Soon</h3>
        <p className="text-blue-700">
          We're working on adding dates, pricing, and booking functionality. Check back soon!
        </p>
      </div>
    </>
  )
}

// Booking Sidebar Component
function BookingSidebar({ camp }: { camp: Camp }) {
  return (
    <div className="sticky top-24">
      <div className="border border-[#DDDDDD] rounded-xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
        <div className="mb-6">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[24px] font-bold text-[#222222]">€830</span>
            <span className="text-[16px] text-[#717171]">/week</span>
          </div>
          <span className="text-[14px] text-[#717171]">Jun 15 - Aug 20</span>
        </div>

        <button className="w-full py-3.5 bg-[#45F0B5] text-[#222222] rounded-[10px] text-base font-semibold hover:bg-[#3de0a5] transition-colors mb-4">
          Reserve
        </button>

        <p className="text-center text-[13px] text-[#717171]">You won't be charged yet</p>
      </div>
    </div>
  )
}

// Activity Sections Component
function ActivitySections({ camp }: { camp: Camp }) {
  const activityConfig: Record<string, { title: string; icon: string; field: keyof Camp }> = {
    sports: { title: 'Sports', icon: '⚽', field: 'sports' },
    languages: { title: 'Languages', icon: '🗣️', field: 'languages' },
    academics: { title: 'Academics', icon: '📚', field: 'academics' },
    adventure: { title: 'Adventure Activities', icon: '🧗', field: 'adventure' },
    arts: { title: 'Arts & Crafts', icon: '🎨', field: 'arts' },
    water: { title: 'Water Activities', icon: '🏊', field: 'water' },
    excursions: { title: 'Excursions & Trips', icon: '🚌', field: 'excursions' },
    environmental: { title: 'Environmental Activities', icon: '🌱', field: 'environmental' },
    religion: { title: 'Religion', icon: '🕊️', field: 'religion' },
  }

  return (
    <div className="space-y-8">
      {camp.activities?.map(activityType => {
        const config = activityConfig[activityType]
        if (!config) return null

        const activityData = camp[config.field]
        if (!activityData) return null

        return (
          <div key={activityType} className="pb-6 border-b border-[#EEEEEE] last:border-0">
            <SectionSubheader title={config.title} className="flex items-center gap-2 mb-4" />
            {activityData.description && (
              <p className="text-[15px] text-[#717171] mb-4">{activityData.description}</p>
            )}
            {activityData.items && activityData.items.length > 0 && (
              <ActivityGrid activities={activityData.items} mobileCount={4} desktopCount={6} />
            )}
          </div>
        )
      })}
      {(!camp.activities || camp.activities.length === 0) && (
        <p className="text-[15px] text-[#717171]">No activities listed yet.</p>
      )}
    </div>
  )
}
