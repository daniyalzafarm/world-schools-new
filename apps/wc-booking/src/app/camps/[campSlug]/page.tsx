'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  CAMPUS_SETTING,
  CAMPUS_SIZE,
  PREDEFINED_DIETARY_OPTIONS,
  PREDEFINED_FACILITIES,
} from '@world-schools/wc-frontend-utils'
import { getCampBySlug } from '@/services/camps.services'
import type { ActivityItem, Camp, MetaCard } from '@/types/camps'
import type { FixedSession, FlexibleSession } from '@/types/sessions'
import config from '@/config/config'
import { InnerPageNav } from '@/components/camp/InnerPageNav'
import { SectionHeader, SectionSubheader } from '@/components/camp/SectionHeader'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { IncludedGrid } from '@/components/camp/IncludedGrid'
import { DailySchedule } from '@/components/camp/DailySchedule'
import { WeeklySchedule } from '@/components/camp/WeeklySchedule'
import { SafetyCard } from '@/components/camp/SafetyCard'
import { ActivitySection } from '@/components/camp/ActivitySection'
import { ActivityGrid } from '@/components/camp/ActivityGrid'
import { PhotoGalleryDrawer } from '@/components/camp/PhotoGalleryDrawer'
import { SessionsSection } from '@/components/camp/SessionsSection'
import { CancellationPolicySection } from '@/components/camp/CancellationPolicySection'
import { ProviderSection } from '@/components/camp/ProviderSection'
import { GoogleMapsLoader } from '@/components/map/GoogleMapsLoader'
import { GoogleMapWithSearch } from '@/components/map/GoogleMapWithSearch'
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
} from '@/utils/activity-transformers'
import { Button } from '@heroui/react'
import { formatCurrency } from '@/utils/currency'

export default function CampPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const campSlug = params.campSlug as string

  const [camp, setCamp] = useState<Camp | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [galleryPhotoIndex, setGalleryPhotoIndex] = useState(-1)

  useEffect(() => {
    const fetchCamp = async () => {
      try {
        setIsLoading(true)
        // Extract preview token from URL if present
        const previewToken = searchParams.get('preview') || undefined
        const campData = await getCampBySlug(campSlug, previewToken)
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
  }, [campSlug, searchParams])

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
          <Button onPress={() => router.push('/')} className="mt-4" color="primary" size="lg">
            Go Home
          </Button>
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
    camp.scheduleType && (camp.dailySchedule || camp.weeklySchedule)
      ? { href: '#schedule', label: 'Schedule' }
      : null,
    camp.meals ? { href: '#meals', label: 'Meals' } : null,
    camp.sessions && camp.sessions.length > 0
      ? { href: '#sessions', label: 'Dates & Pricing' }
      : null,
    camp.campusFacilities ? { href: '#campus', label: 'Location' } : null,
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
        <div className="block lg:hidden relative w-full h-96 bg-gray-200">
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
        <div className="hidden lg:block max-w-screen-2xl mx-auto px-20 xl:px-32 mt-6 mb-10">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[480px] rounded-xl overflow-hidden relative">
            {/* Primary Image - Index 0 */}
            <div
              className="col-span-2 row-span-2 bg-gray-200 cursor-pointer group relative overflow-hidden"
              onClick={() => {
                if (camp.photos && camp.photos.length > 0) {
                  setGalleryPhotoIndex(0)
                  setIsGalleryOpen(true)
                }
              }}
            >
              <img
                src={primaryPhotoUrl || '/placeholder-camp.jpg'}
                alt={camp.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </div>
            {/* Thumbnail Images - Indices 1-4 */}
            {camp.photos?.slice(1, 5).map((photo, index) => (
              <div
                key={photo.id}
                className="bg-gray-200 cursor-pointer group relative overflow-hidden"
                onClick={() => {
                  setGalleryPhotoIndex(index + 1)
                  setIsGalleryOpen(true)
                }}
              >
                <img
                  src={getImageUrl(photo.url)}
                  alt={`${camp.name} ${index + 2}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
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
            {camp.photos && camp.photos.length > 0 && (
              <div className="absolute bottom-5 right-5 z-10">
                <PhotoGalleryDrawer
                  photos={camp.photos}
                  campName={camp.name}
                  isOpen={isGalleryOpen}
                  onOpenChange={setIsGalleryOpen}
                  initialLightboxIndex={galleryPhotoIndex}
                  trigger={
                    <Button
                      className="bg-white text-gray-900"
                      onPress={() => {
                        setGalleryPhotoIndex(-1)
                        setIsGalleryOpen(true)
                      }}
                      startContent={<span>🖼️</span>}
                    >
                      Show all photos
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Wrapper */}
      <div className="max-w-screen-2xl mx-auto px-5 md:px-20 lg:px-32 pb-20">
        <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-24">
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-5 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] z-40">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-500">From</span>
              <span className="text-2xl font-bold text-gray-900">€830</span>
              <span className="text-sm text-gray-500">/week</span>
            </div>
            <span className="text-xs text-gray-500">Jun 15 - Aug 20</span>
          </div>
          <button className="px-8 py-3.5 bg-primary text-gray-900 rounded-lg text-base font-semibold hover:bg-primary-300 transition-colors whitespace-nowrap">
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
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{camp.name}</h1>

        <div className="flex flex-wrap items-center gap-3 text-base text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-base">⭐</span>
            <span className="font-semibold text-gray-900">4.9</span>
            <span>(127 reviews)</span>
          </div>
          <span>•</span>
          <span>{camp.locationName || 'Location TBD'}</span>
        </div>
      </div>

      {/* About This Camp */}
      <div className="mb-12 pb-8 border-b border-gray-300">
        <SectionHeader title="About This Camp" className="mb-4" />

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
          {/* Gender Tag */}
          <span className="px-3 py-1.5 bg-gray-100 rounded-full font-medium text-gray-900">
            {camp.gender === 'coed' && '🧑‍🤝‍🧑 Co-Education'}
            {camp.gender === 'boys' && '👦 Boys Only'}
            {camp.gender === 'girls' && '👧 Girls Only'}
          </span>

          {/* Age Range Tag */}
          <span className="px-3 py-1.5 bg-gray-100 rounded-full font-medium text-gray-900">
            👶 {getAgeRangeText()}
          </span>

          {/* Camp Type Tag */}
          <span className="px-3 py-1.5 bg-gray-100 rounded-full font-medium text-gray-900">
            {camp.type === 'day' ? '☀️ Day Camp' : '⛺ Sleepaway Camp'}
          </span>

          {/* Camp Focus Tag - Only show if primaryFocus exists */}
          {camp.campFocus?.primaryFocus && (
            <span className="px-3 py-1.5 bg-gray-100 rounded-full font-medium text-gray-900">
              {camp.campFocus.primaryFocus.icon} {camp.campFocus.primaryFocus.activityName} Focus
            </span>
          )}
        </div>

        {camp.description && <ExpandableText text={camp.description} maxLines={4} />}
      </div>

      {/* What's Included */}
      {camp.whatsIncluded && (
        <div id="included" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="What's Included" className="mb-6" />
          <IncludedGrid
            items={[
              ...(camp.whatsIncluded.manual || []),
              ...(camp.whatsIncluded.autoGenerated || []),
            ].filter(item => item.isSelected)}
          />
        </div>
      )}

      {/* Activities Section */}
      <div id="activities" className="mb-12 pb-8 border-b border-gray-300">
        <SectionHeader title="Activities" className="mb-6" />
        <ActivitySections camp={camp} />
      </div>

      {/* Schedule Section - Daily or Weekly */}
      {camp.scheduleType && (camp.dailySchedule || camp.weeklySchedule) && (
        <div id="schedule" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader
            title={camp.scheduleType === 'daily' ? 'A Day at Camp' : 'Weekly Schedule'}
            icon="📅"
            className="mb-6"
          />

          {camp.scheduleType === 'daily' && camp.dailySchedule?.timeSlots && (
            <DailySchedule schedule={camp.dailySchedule.timeSlots} />
          )}

          {camp.scheduleType === 'weekly' && camp.weeklySchedule && (
            <WeeklySchedule schedule={camp.weeklySchedule} />
          )}

          {/* Empty state */}
          {camp.scheduleType === 'daily' && !camp.dailySchedule?.timeSlots?.length && (
            <p className="text-base text-gray-500">No daily schedule available yet.</p>
          )}
        </div>
      )}

      {/* Meals */}
      {camp.meals && (
        <div id="meals" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Meals" icon="🍽️" className="mb-6" />

          {/* Meals Description */}
          {camp.meals.description && (
            <p className="text-base text-gray-500 mb-6">{camp.meals.description}</p>
          )}

          {/* Dietary Options */}
          {camp.meals.dietaryOptions && camp.meals.dietaryOptions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dietary Options</h3>
              <ActivityGrid
                activities={camp.meals.dietaryOptions
                  .map((optionId: string) => {
                    const option = PREDEFINED_DIETARY_OPTIONS.find(opt => opt.id === optionId)
                    return option ? { id: option.id, name: option.name, icon: option.icon } : null
                  })
                  .filter((item): item is ActivityItem => item !== null)}
                mobileCount={4}
                desktopCount={8}
              />
            </div>
          )}

          {/* Legacy meals items (if any) */}
          {camp.meals.items && camp.meals.items.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {camp.meals.items.map((meal: any, index: number) => (
                <div key={index} className="bg-gray-100 rounded-xl p-4">
                  <div className="text-2xl mb-2">{meal.icon}</div>
                  <div className="text-base font-semibold text-gray-900">{meal.name}</div>
                  {meal.description && (
                    <div className="text-sm text-gray-500 mt-1">{meal.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sessions - Dates & Pricing */}
      {camp.sessions && camp.sessions.length > 0 && (
        <div id="sessions" className="mb-12 pb-8 border-b border-gray-300">
          <SessionsSection
            sessions={camp.sessions}
            sessionType={camp.sessionType}
            campName={camp.name}
            currency={camp.provider?.settings?.currency || 'USD'}
          />
        </div>
      )}

      {/* Cancellation Policy */}
      {camp.provider?.settings?.cancellationPolicy && (
        <div id="cancellation-policy">
          <CancellationPolicySection
            policy={camp.provider.settings.cancellationPolicy as any}
            customPolicy={camp.provider.settings.cancellationPolicyCustom}
          />
        </div>
      )}

      {/* Screen Time Policy */}
      {camp.screenPolicy && (
        <div id="screen-policy" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Screen Time Policy" icon="📱" className="mb-6" />
          {camp.screenPolicy.description && (
            <p className="text-base text-gray-900">{camp.screenPolicy.description}</p>
          )}
        </div>
      )}

      {/* Safety & Supervision */}
      {camp.safetySupervision && (
        <div id="safety" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Safety & Supervision" icon="🛡️" className="mb-6" />
          {camp.safetySupervision.description && (
            <p className="text-base text-gray-500 mb-6">{camp.safetySupervision.description}</p>
          )}
          <SafetyCard ratios={camp.safetySupervision.ratios} items={camp.safetySupervision.items} />
        </div>
      )}

      {/* Location & Campus */}
      {camp.campusFacilities && (
        <div id="campus" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Location & Campus" icon="🏫" className="mb-6" />

          {/* Google Map */}
          {camp.locationLat && camp.locationLng && (
            <div className="mb-6">
              <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
                <div className="h-[400px] w-full rounded-xl overflow-hidden border border-gray-300">
                  <GoogleMapWithSearch
                    selectedPlace={{
                      lat:
                        typeof camp.locationLat === 'string'
                          ? parseFloat(camp.locationLat)
                          : camp.locationLat,
                      lng:
                        typeof camp.locationLng === 'string'
                          ? parseFloat(camp.locationLng)
                          : camp.locationLng,
                      name: camp.locationName || camp.name,
                    }}
                  />
                </div>
              </GoogleMapsLoader>
            </div>
          )}

          {/* Location Information */}
          {(camp.locationName || camp.locationAddress) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              {camp.locationName && (
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{camp.locationName}</h3>
              )}
              {camp.locationAddress && (
                <p className="text-base text-gray-500">{camp.locationAddress}</p>
              )}
            </div>
          )}

          {/* Campus Description */}
          {camp.campusFacilities.description && (
            <div className="mb-6">
              <p className="text-base text-gray-500">{camp.campusFacilities.description}</p>
            </div>
          )}

          {/* Campus Size and Setting */}
          {(camp.campusFacilities.campusSize || camp.campusFacilities.campusSetting) && (
            <div className="mb-6 flex flex-wrap gap-3">
              {camp.campusFacilities.campusSize && (
                <div className="px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">
                    {CAMPUS_SIZE.find(s => s.value === camp.campusFacilities?.campusSize)?.label ||
                      camp.campusFacilities.campusSize}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    (
                    {
                      CAMPUS_SIZE.find(s => s.value === camp.campusFacilities?.campusSize)
                        ?.description
                    }
                    )
                  </span>
                </div>
              )}
              {camp.campusFacilities.campusSetting && (
                <div className="px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">
                    {CAMPUS_SETTING.find(s => s.value === camp.campusFacilities?.campusSetting)
                      ?.label || camp.campusFacilities.campusSetting}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    (
                    {
                      CAMPUS_SETTING.find(s => s.value === camp.campusFacilities?.campusSetting)
                        ?.description
                    }
                    )
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campus Facilities */}
          {camp.campusFacilities.selectedFacilities &&
            camp.campusFacilities.selectedFacilities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campus Facilities</h3>
                <ActivityGrid
                  activities={camp.campusFacilities.selectedFacilities
                    .map((facilityId: string) => {
                      const facility = PREDEFINED_FACILITIES.find(f => f.id === facilityId)
                      return facility
                        ? { id: facility.id, name: facility.name, icon: facility.icon }
                        : null
                    })
                    .filter((item): item is ActivityItem => item !== null)}
                  mobileCount={4}
                  desktopCount={8}
                />
              </div>
            )}
        </div>
      )}

      {/* Location & Getting There */}
      {(camp.locationCampus || camp.gettingThere) && (
        <div id="location" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Location & Getting There" icon="📍" className="mb-6" />

          {camp.locationCampus?.description && (
            <div className="mb-6">
              <SectionSubheader title="Campus" className="mb-3" />
              <p className="text-base text-gray-500">{camp.locationCampus.description}</p>
            </div>
          )}

          {camp.gettingThere?.options && (
            <div>
              <SectionSubheader title="Getting There" className="mb-3" />
              <div className="space-y-3">
                {camp.gettingThere.options.map((option: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-gray-100 rounded-xl">
                    <span className="text-2xl">{option.icon}</span>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-gray-900 mb-1">
                        {option.name}
                      </div>
                      {option.description && (
                        <div className="text-sm text-gray-500">{option.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provider/Organizer Information */}
      {camp.provider && (
        <div id="provider">
          <ProviderSection provider={camp.provider} />
        </div>
      )}

      {/* Accommodation */}
      {camp.accommodation && camp.type === 'residential' && (
        <div id="accommodation" className="mb-12 pb-8 border-b border-gray-300">
          <SectionHeader title="Accommodation" icon="🏠" className="mb-6" />
          {camp.accommodation.description && (
            <p className="text-base text-gray-500 mb-6">{camp.accommodation.description}</p>
          )}
          {camp.accommodation.items && camp.accommodation.items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {camp.accommodation.items.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-primary text-lg font-bold shrink-0 mt-0.5">✓</span>
                  <span className="text-base text-gray-900">{item}</span>
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
  const [selectedSession, setSelectedSession] = useState<(FixedSession | FlexibleSession) | null>(
    null
  )

  const sessions = camp.sessions ?? []
  const activeSessions = sessions.filter(s => s.isActive)
  const currency = camp.provider?.settings?.currency || 'USD'

  // Calculate minimum price from sessions
  const getMinPrice = () => {
    if (activeSessions.length === 0) return null

    const prices = activeSessions.map(session => {
      if (session.type === 'fixed') {
        return (session as FixedSession).price
      } else {
        return (session as FlexibleSession).basePricePerDay ?? 0
      }
    })

    return Math.min(...prices)
  }

  const minPrice = getMinPrice()

  // Get up to 3 sessions to display
  const displayedSessions = activeSessions.slice(0, 3)

  // Determine badge for each session
  const getSessionBadge = (session: FixedSession | FlexibleSession, index: number) => {
    const spotsLeft = session.capacity ?? null

    // LAST SPOTS - if 5 or fewer spots left
    if (spotsLeft !== null && spotsLeft <= 5) {
      return { text: 'LAST SPOTS', icon: '🔥', color: 'border-red-500 text-red-700 bg-red-50' }
    }

    // NEXT AVAILABLE - first session
    if (index === 0) {
      return {
        text: 'NEXT AVAILABLE',
        icon: '🚀',
        color: 'border-teal-500 text-teal-700 bg-teal-50',
      }
    }

    // MOST POPULAR - second session
    if (index === 1) {
      return {
        text: 'MOST POPULAR',
        icon: '⭐',
        color: 'border-yellow-500 text-yellow-700 bg-yellow-50',
      }
    }

    return null
  }

  // Handle session selection
  const handleSessionClick = (session: FixedSession | FlexibleSession) => {
    if (selectedSession?.id === session.id) {
      setSelectedSession(null) // Deselect if clicking the same session
    } else {
      setSelectedSession(session)
    }
  }

  // Get selected session price
  const getSelectedPrice = () => {
    if (!selectedSession) return null
    if (selectedSession.type === 'fixed') {
      return (selectedSession as FixedSession).price
    } else {
      return (selectedSession as FlexibleSession).basePricePerDay ?? 0
    }
  }

  // Get selected session date range
  const getSelectedDateRange = () => {
    if (!selectedSession) return null

    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (selectedSession.type === 'fixed') {
      const fixedSession = selectedSession as FixedSession
      const startDate = new Date(fixedSession.sessionStartDate)
      const endDate = new Date(fixedSession.sessionEndDate)
      const year = endDate.getFullYear()
      return `${formatDate(fixedSession.sessionStartDate)} - ${formatDate(fixedSession.sessionEndDate)}, ${year}`
    } else {
      const flexSession = selectedSession as FlexibleSession
      const startDate = new Date(flexSession.startDate)
      const endDate = new Date(flexSession.endDate)
      const year = endDate.getFullYear()
      return `${formatDate(flexSession.startDate)} - ${formatDate(flexSession.endDate)}, ${year}`
    }
  }

  const selectedPrice = getSelectedPrice()
  const selectedDateRange = getSelectedDateRange()

  return (
    <div className="sticky top-24">
      <div className="border border-gray-300 rounded-xl p-6 shadow-lg">
        {/* Price Header - Dynamic based on selection */}
        {!selectedSession && minPrice !== null && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-600">From</span>
              <span className="text-3xl font-bold text-gray-900">
                {formatCurrency(minPrice, currency)}
              </span>
              <span className="text-base text-gray-500">/week</span>
            </div>
          </div>
        )}

        {selectedSession && selectedPrice !== null && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {formatCurrency(selectedPrice, currency)}
              </span>
              <span className="text-sm text-gray-600">{selectedDateRange}</span>
            </div>
          </div>
        )}

        {/* Sessions List */}
        {displayedSessions.length > 0 && (
          <div className="space-y-4 mb-6">
            {displayedSessions.map((session, index) => (
              <SidebarSessionCard
                key={session.id}
                session={session}
                badge={getSessionBadge(session, index)}
                isSelected={selectedSession?.id === session.id}
                onClick={() => handleSessionClick(session)}
                currency={currency}
              />
            ))}
          </div>
        )}

        {/* View All Sessions Link */}
        {activeSessions.length > 3 && (
          <div className="mb-6 text-center">
            <a
              href="#sessions"
              className="text-sm font-semibold text-gray-900 hover:underline inline-flex items-center gap-1"
            >
              View all {activeSessions.length} sessions →
            </a>
          </div>
        )}

        {/* Dynamic Button - Check Availability or Reserve Now */}
        <Button
          color="primary"
          size="lg"
          className="w-full font-semibold"
          onPress={() => {
            if (selectedSession) {
              // TODO: Implement reserve functionality
              console.log('Reserve session:', selectedSession)
            } else {
              // Scroll to sessions section
              document.getElementById('sessions')?.scrollIntoView({ behavior: 'smooth' })
            }
          }}
        >
          {selectedSession ? 'Reserve' : 'Check availability'}
        </Button>

        {/* Questions Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-3">Questions?</p>
          <Button
            variant="bordered"
            size="lg"
            color="secondary"
            className="w-full"
            onPress={() => {
              // TODO: Implement message organizer functionality
              console.log('Message organizer clicked')
            }}
          >
            Message organizer
          </Button>
        </div>
      </div>
    </div>
  )
}

// Sidebar Session Card Component
interface SidebarSessionCardProps {
  session: FixedSession | FlexibleSession
  badge: { text: string; icon: string; color: string } | null
  isSelected: boolean
  onClick: () => void
  currency?: string
}

function SidebarSessionCard({
  session,
  badge,
  isSelected,
  onClick,
  currency = 'USD',
}: SidebarSessionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const year = endDate.getFullYear()

    return `${formatDate(start)} - ${formatDate(end)}, ${year}`
  }

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const weeks = Math.floor(durationDays / 7)
    const days = durationDays % 7

    if (weeks > 0 && days === 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''}`
    } else if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''}`
    } else {
      return `${durationDays} day${durationDays > 1 ? 's' : ''}`
    }
  }

  const getAgeRangeText = () => {
    if (session.type === 'flexible') {
      const flexSession = session as FlexibleSession
      if (flexSession.ageRange) {
        return `Ages ${flexSession.ageRange.min}-${flexSession.ageRange.max}`
      }
    }
    // For fixed sessions, we'd need to get age range from camp data
    // For now, return null
    return null
  }

  const getSpotsLeftText = () => {
    const capacity = session.capacity
    if (capacity === null || capacity === undefined) return null

    if (capacity <= 5) {
      return `Only ${capacity} left`
    } else {
      return `${capacity} spots left`
    }
  }

  const getPrice = () => {
    if (session.type === 'fixed') {
      return (session as FixedSession).price
    } else {
      return (session as FlexibleSession).basePricePerDay ?? 0
    }
  }

  const getDateRange = () => {
    if (session.type === 'fixed') {
      const fixedSession = session as FixedSession
      return formatDateRange(fixedSession.sessionStartDate, fixedSession.sessionEndDate)
    } else {
      const flexSession = session as FlexibleSession
      return formatDateRange(flexSession.startDate, flexSession.endDate)
    }
  }

  const getDuration = () => {
    if (session.type === 'fixed') {
      const fixedSession = session as FixedSession
      return calculateDuration(fixedSession.sessionStartDate, fixedSession.sessionEndDate)
    }
    return null
  }

  const ageRangeText = getAgeRangeText()
  const spotsLeftText = getSpotsLeftText()
  const duration = getDuration()

  return (
    <div
      className={`relative border-2 rounded-lg p-4 transition-all cursor-pointer ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
      onClick={onClick}
    >
      {/* Badge - Positioned on the border */}
      {badge && (
        <div
          className={`absolute -top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </div>
      )}

      {/* Session Name and Price */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 flex-1">{session.name}</h3>
        <div className="text-right ml-3">
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(getPrice(), currency)}
          </div>
        </div>
      </div>

      {/* Date Range */}
      <p className="text-sm text-gray-600 mb-1">{getDateRange()}</p>

      {/* Duration, Age Range, Spots Left */}
      <div className="text-sm text-gray-600">
        {duration && <span>{duration}</span>}
        {duration && ageRangeText && <span> • </span>}
        {ageRangeText && <span>{ageRangeText}</span>}
        {(duration || ageRangeText) && spotsLeftText && <span> • </span>}
        {spotsLeftText && <span className="font-medium">{spotsLeftText}</span>}
      </div>
    </div>
  )
}

// Helper function to build meta cards for sports
function getSportsMetaCards(sports: any): MetaCard[] {
  const cards: MetaCard[] = []

  if (sports.skillLevel) {
    const label = getSkillLevelLabel(sports.skillLevel)
    if (label) {
      cards.push({ label: 'Skill Level', value: label })
    }
  }

  if (sports.coachingType) {
    const label = getCoachingTypeLabel(sports.coachingType)
    if (label) {
      cards.push({ label: 'Coaching Type', value: label })
    }
  }

  return cards
}

// Helper function to build meta cards for academics
function getAcademicsMetaCards(academics: any): MetaCard[] {
  const cards: MetaCard[] = []

  if (academics.teachingApproach) {
    const label = getTeachingApproachLabel(academics.teachingApproach)
    if (label) {
      cards.push({ label: 'Teaching Approach', value: label })
    }
  }

  return cards
}

// Activity Sections Component
function ActivitySections({ camp }: { camp: Camp }) {
  const activityConfig: Record<
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
      getBadges: (data: any) => data.badges || [],
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
      getBadges: (data: any) => data.badges || [],
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
    // Handle both 'environment' and 'environmental' from backend
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

  return (
    <div className="space-y-8">
      {camp.activities?.map(activityType => {
        const config = activityConfig[activityType]
        if (!config) return null

        // Get activity data from the correct field
        const activityData = (camp as any)[config.dataField]
        if (!activityData) return null

        // Transform the data to get ActivityItem[] with icons
        const items = config.transformData(activityData)

        // Build meta cards if function exists
        const metaCards = config.getMetaCards ? config.getMetaCards(activityData) : undefined

        // Build badges if function exists
        const badges = config.getBadges ? config.getBadges(activityData) : undefined

        return (
          <ActivitySection
            key={activityType}
            title={config.title}
            icon={config.icon}
            description={activityData.description}
            metaCards={metaCards}
            badges={badges}
            items={items}
            totalCount={items.length}
          />
        )
      })}
      {(!camp.activities || camp.activities.length === 0) && (
        <p className="text-base text-gray-500">No activities listed yet.</p>
      )}
    </div>
  )
}
