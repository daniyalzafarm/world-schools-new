'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  CAMPUS_SETTING,
  CAMPUS_SIZE,
  PREDEFINED_FACILITIES,
} from '@world-schools/wc-frontend-utils'
import { Button } from '@heroui/react'
import { CircleCheck, Images, MapPin, Star } from 'lucide-react'
import { cn, StarRating } from '@world-schools/ui-web'
import { getCampBySlug, getCampReviews } from '@/services/camps.services'
import { campAddOnsService } from '@/services/camp-addons.services'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'
import type { CampBookingAddOn } from '@/types/camp-booking'
import type { CampReviewsData } from '@/types/reviews'
import config from '@/config/config'
import { InnerPageNav } from '@/components/camp/InnerPageNav'
import { ExpandableText } from '@/components/camp/ExpandableText'
import { IncludedGrid } from '@/components/camp/IncludedGrid'
import { CampActivitiesSection } from '@/components/camp/CampActivitiesSection'
import { PhotoGalleryDrawer } from '@/components/camp/PhotoGalleryDrawer'
import { SessionsSection } from '@/components/camp/SessionsSection'
import { CancellationPolicySection } from '@/components/camp/CancellationPolicySection'
import { ProviderSection } from '@/components/camp/ProviderSection'
import { CampStatsBar } from '@/components/camp/CampStatsBar'
import { FaqSection } from '@/components/camp/FaqSection'
import { AccordionGroup } from '@/components/camp/AccordionGroup'
import { SessionsModal } from '@/components/camp/SessionsModal'
import { ReviewsSection } from '@/components/camp/ReviewsSection'
import { CampSidebar } from '@/components/camp/CampSidebar'
import { MobileStickyFooter } from '@/components/camp/MobileStickyFooter'
import { SafetyCard } from '@/components/camp/SafetyCard'
import { GoogleMapsLoader } from '@/components/map/GoogleMapsLoader'
import { GoogleMapWithSearch } from '@/components/map/GoogleMapWithSearch'
import { getSkillLevelLabel } from '@/utils/activity-transformers'
import {
  buildActivitiesFaq,
  buildAgesFaq,
  buildCancellationFaq,
  buildIncludedFaq,
  buildMealsFaq,
  buildTransportFaq,
  buildTypeFaq,
} from '@/utils/faq-builders'
import { CampPageTopbar } from '@/components/camp/CampPageTopbar'

const PREDEFINED_TRANSPORT = [
  { id: 'airport-pickup', name: 'Airport Pickup', icon: '✈️' },
  { id: 'bus-service', name: 'Bus Service', icon: '🚌' },
  { id: 'train-station', name: 'Train Station Pickup', icon: '🚂' },
  { id: 'shuttle', name: 'Shuttle Service', icon: '🚐' },
  { id: 'private-transfer', name: 'Private Transfer', icon: '🚗' },
  { id: 'group-transport', name: 'Group Transport', icon: '🚌' },
]

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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false)
  const [addOns, setAddOns] = useState<CampBookingAddOn[]>([])
  const [campReviews, setCampReviews] = useState<CampReviewsData | null>(null)
  const [innerNavReplacesTopbar, setInnerNavReplacesTopbar] = useState(false)

  useEffect(() => {
    if (!campSlug) return
    const fetchCamp = async () => {
      try {
        setIsLoading(true)
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
    fetchCamp().catch(console.error)
  }, [campSlug, searchParams])

  // Fetch add-ons after camp loads
  useEffect(() => {
    if (!camp?.id) return
    campAddOnsService
      .getByCampId(camp.id)
      .then(res => {
        if (res.success && Array.isArray(res.data)) setAddOns(res.data)
      })
      .catch(() => {})
  }, [camp?.id])

  // Fetch camp reviews after camp loads (used in header + reviews section)
  useEffect(() => {
    if (!camp?.id) return
    getCampReviews(camp.id)
      .then(setCampReviews)
      .catch(() => {})
  }, [camp?.id])

  // Camp profile: after gallery clears the top of the viewport, inner nav replaces main topbar (model B).
  useEffect(() => {
    if (!camp) {
      setInnerNavReplacesTopbar(false)
      return
    }
    const gallery = document.getElementById('gallery')
    if (!gallery) return

    const tick = () => {
      setInnerNavReplacesTopbar(gallery.getBoundingClientRect().bottom <= 0)
    }
    tick()
    window.addEventListener('scroll', tick, { passive: true })
    window.addEventListener('resize', tick)
    const ro = new ResizeObserver(tick)
    ro.observe(gallery)
    return () => {
      window.removeEventListener('scroll', tick)
      window.removeEventListener('resize', tick)
      ro.disconnect()
    }
  }, [camp])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <CampPageTopbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
            <p className="mt-4 text-gray-600">Loading camp details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !camp) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <CampPageTopbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Camp Not Found</h1>
            <p className="text-gray-600">
              {error || 'The camp you are looking for does not exist.'}
            </p>
            <Button onPress={() => router.push('/')} className="mt-4" color="primary" size="lg">
              Go Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getImageUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const storageUrl = config.app.storageUrl.endsWith('/')
      ? config.app.storageUrl
      : `${config.app.storageUrl}/`
    return `${storageUrl}${url}`
  }

  const primaryPhoto = camp.photos?.find(p => p.isPrimary)?.url || camp.photos?.[0]?.url
  const primaryPhotoUrl = primaryPhoto ? getImageUrl(primaryPhoto) : null

  const sessions = camp.sessions ?? []
  const activeSessions = sessions.filter(s => s.status === 'published')
  const currency = camp.provider?.settings?.currency || 'USD'

  // Derive primary activity from campFocusRecord (authoritative) or campFocus (fallback)
  const primaryActivity =
    camp.campFocusRecord?.activity ??
    (camp.campFocus?.primaryFocus
      ? {
          id: '',
          name: camp.campFocus.primaryFocus.activityName,
          emoji: camp.campFocus.primaryFocus.icon,
          slug: '',
        }
      : null)

  // Auto-generated descriptive H2
  const campLabel = [camp.type, primaryActivity?.name?.toLowerCase(), 'camp']
    .filter(Boolean)
    .join(' ')
  const locationParts =
    camp.locationAddress
      ?.split(',')
      .map((p: string) => p.trim())
      .filter(Boolean) ?? []
  const locationLabel = locationParts.at(-2) ?? locationParts.at(-1) ?? ''
  const descriptiveH2 = locationLabel
    ? `${campLabel.charAt(0).toUpperCase()}${campLabel.slice(1)} in ${locationLabel}`
    : `${campLabel.charAt(0).toUpperCase()}${campLabel.slice(1)}`

  const hasCampReviews = (campReviews?.totalReviews ?? 0) > 0
  const gbpRating = camp.provider?.googleBusinessProfile?.rating
  const gbpReviewsCount = camp.provider?.googleBusinessProfile?.reviewsCount
  const hasGbpReviews = (gbpReviewsCount ?? 0) > 0
  const headerRating = hasCampReviews
    ? campReviews!.overallRating
    : hasGbpReviews && gbpRating != null
      ? Number(gbpRating)
      : null
  const headerReviewsCount = hasCampReviews
    ? campReviews!.totalReviews
    : hasGbpReviews
      ? gbpReviewsCount!
      : null
  const headerAddress = camp.locationAddress || ''
  const isVerifiedProvider = camp.provider?.approvalStatus === 'approved'
  const headerTrustScore = camp.provider?.trustScore
  const statsLevelLabel = getSkillLevelLabel(camp.sports?.skillLevel) ?? null
  const focusStatEmoji =
    primaryActivity?.emoji?.trim() || camp.campFocusRecord?.category?.emoji?.trim() || undefined

  // Auto-generated FAQ
  const faqItems = [
    buildAgesFaq(camp.ageGroups ?? []),
    buildTypeFaq(camp.type),
    buildActivitiesFaq(camp.campFocus),
    buildIncludedFaq(camp.whatsIncluded),
    buildMealsFaq(camp.meals),
    buildCancellationFaq(
      camp.provider?.settings?.cancellationPolicy,
      camp.provider?.settings?.cancellationPolicyCustom
    ),
    buildTransportFaq(addOns, currency),
  ].filter(Boolean) as { question: string; answer: string }[]

  // Navigation links per target section order
  const navLinks = [
    { href: '#about', label: 'About' },
    camp.whatsIncluded ? { href: '#included', label: "What's Included" } : null,
    activeSessions.length > 0 ? { href: '#sessions', label: 'Dates & Pricing' } : null,
    camp.activities?.length ? { href: '#activities', label: 'Activities' } : null,
    { href: '#reviews', label: 'Reviews' },
    camp.safetySupervision ? { href: '#safety', label: 'Safety' } : null,
    { href: '#location', label: 'Location' },
    camp.provider ? { href: '#organizer', label: 'Organizer' } : null,
    faqItems.length > 0 ? { href: '#faq', label: 'FAQ' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  const isAnyModalOpen = isSessionsModalOpen || isGalleryOpen

  return (
    <div className="min-h-screen bg-white">
      <CampPageTopbar suppressed={innerNavReplacesTopbar} />
      {/* ── 1. Hero Gallery ─────────────────────────────────────────── */}
      <div id="gallery">
        {/* Mobile — module-02 Variant C: single photo + count badge */}
        <div className="block sm:hidden relative w-full h-[240px] overflow-hidden bg-gray-200">
          <img
            src={primaryPhotoUrl || '/placeholder-camp.jpg'}
            alt={camp.name}
            className="h-full w-full object-cover"
            onClick={() => {
              if (camp.photos?.length) {
                setGalleryPhotoIndex(0)
                setIsGalleryOpen(true)
              }
            }}
          />
          {camp.photos && camp.photos.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
              1 / {camp.photos.length} photos
            </div>
          )}
        </div>

        {/* sm+ — 5-photo grid; aspect-ratio fixed so proportions match at every breakpoint */}
        <div className="mx-auto mt-4 mb-8 hidden max-w-screen-2xl px-5 sm:block sm:px-8 lg:mt-6 lg:mb-10 lg:px-8 xl:px-32">
          <div className="relative grid w-full grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl aspect-2/1">
            <div
              className="group relative col-span-2 row-span-2 cursor-pointer overflow-hidden bg-gray-300"
              onClick={() => {
                if (camp.photos?.length) {
                  setGalleryPhotoIndex(0)
                  setIsGalleryOpen(true)
                }
              }}
            >
              <img
                src={primaryPhotoUrl || '/placeholder-camp.jpg'}
                alt={camp.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </div>
            {(camp.photos ?? []).slice(1, 5).map((photo, index) => (
              <div
                key={photo.id}
                className="group cursor-pointer overflow-hidden bg-gray-200"
                onClick={() => {
                  setGalleryPhotoIndex(index + 1)
                  setIsGalleryOpen(true)
                }}
              >
                <img
                  src={getImageUrl(photo.url)}
                  alt={`${camp.name} ${index + 2}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            ))}
            {Array.from({
              length: Math.max(0, 4 - (camp.photos ?? []).slice(1, 5).length),
            }).map((_, i) => (
              <div key={`ph-${i}`} className="bg-gray-200" />
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
                      className="h-auto min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-md"
                      onPress={() => {
                        setGalleryPhotoIndex(-1)
                        setIsGalleryOpen(true)
                      }}
                      startContent={<Images size={15} className="shrink-0" aria-hidden />}
                    >
                      Show all {camp.photos.length} photos
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Inner Nav (fixed; visible only after gallery scrolls past) ─ */}
      <InnerPageNav links={navLinks} visible={innerNavReplacesTopbar} />

      {/* ── Page body: content + sidebar ─────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-32 pb-32 lg:pb-20">
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-16 xl:gap-24">
          {/* ── Left: Main content column ──────────────────────────── */}
          <div className="min-w-0">
            {/* ── 3. About ──────────────────────────────────────────── */}
            <section id="about" className="mb-10 scroll-mt-14 pt-6 md:mb-12 md:scroll-mt-16">
              {/* Module 01 — camp title */}
              <h1 className="mb-2 text-[26px] leading-tight font-bold text-gray-900 sm:text-3xl lg:text-[36px]">
                {camp.name}
              </h1>

              {/* Meta — module-01: two lines, rating row + location row */}
              {(headerRating != null ||
                isVerifiedProvider ||
                headerTrustScore != null ||
                headerAddress) && (
                <div className="mb-4 flex flex-col gap-y-1.5 text-base text-gray-600 md:mb-5">
                  {(headerRating != null || isVerifiedProvider || headerTrustScore != null) && (
                    <div className="flex flex-wrap items-center gap-2 text-[15px]">
                      {headerRating != null && (
                        <span className="flex items-center gap-1">
                          <StarRating
                            rating={headerRating}
                            showRating={false}
                            color="yellow"
                            size={16}
                          />
                          <span className="font-bold text-gray-900">{headerRating.toFixed(1)}</span>
                        </span>
                      )}
                      {headerRating != null && !!headerReviewsCount && (
                        <>
                          <span className="text-gray-500">·</span>
                          <a
                            href="#reviews"
                            className="underline underline-offset-2 hover:text-gray-900"
                          >
                            {headerReviewsCount} reviews
                          </a>
                        </>
                      )}
                      {isVerifiedProvider && (
                        <>
                          {headerRating != null && <span className="text-gray-500">·</span>}
                          <span className="inline-flex items-center gap-0.5 text-sm font-bold text-primary-700">
                            <CircleCheck size={16} />
                            Verified
                          </span>
                        </>
                      )}
                      {headerTrustScore != null && (
                        <>
                          {/* {(headerRating != null || isVerifiedProvider) && (
                            <span className="text-gray-500">·</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                            🛡
                            <span>
                              Trust score{' '}
                              <span className="underline underline-offset-2">
                                {headerTrustScore}/100
                              </span>
                            </span>
                          </span> */}
                        </>
                      )}
                    </div>
                  )}

                  {headerAddress && (
                    <div className="flex flex-wrap items-center gap-2 text-[15px]">
                      <MapPin size={16} />
                      <span>{headerAddress}</span>
                      <span className="text-gray-500">·</span>
                      <a
                        href="#location"
                        className="text-secondary-700 underline underline-offset-2 hover:text-primary-600"
                      >
                        Show on map
                      </a>
                    </div>
                  )}
                </div>
              )}

              <CampStatsBar
                gender={camp.gender}
                ageGroups={camp.ageGroups ?? []}
                primaryFocus={primaryActivity ? { activityName: primaryActivity.name } : null}
                focusEmoji={focusStatEmoji}
                campType={camp.type}
                levelLabel={statsLevelLabel}
                className="mb-6"
              />

              {/* Subtitle / descriptive line (camp-specific; not in static mock) */}
              <h2 className="mb-3 text-lg font-bold md:mb-4 md:text-xl">{descriptiveH2}</h2>
              {camp.description && <ExpandableText text={camp.description} maxLines={4} />}
            </section>

            {/* ── 4. What's Included ────────────────────────────────── */}
            {camp.whatsIncluded && (
              <section
                id="included"
                className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
              >
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
                  What&apos;s Included
                </h2>
                <IncludedGrid
                  items={[
                    ...(camp.whatsIncluded.manual || []),
                    ...(camp.whatsIncluded.autoGenerated || []),
                  ].filter(item => item.isSelected)}
                />
              </section>
            )}

            {/* ── 5. Dates & Pricing ────────────────────────────────── */}
            <SessionsSection
              sessions={activeSessions}
              sessionType={camp.sessionType}
              campName={camp.name}
              currency={currency}
              ageGroups={camp.ageGroups}
              campType={camp.type}
              campSlug={camp.slug}
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
              onOpenSessionsModal={() => setIsSessionsModalOpen(true)}
            />

            {/* ── 6. Activities ─────────────────────────────────────── */}
            {camp.activities && camp.activities.length > 0 && (
              <section
                id="activities"
                className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
              >
                <CampActivitiesSection camp={camp} />
              </section>
            )}

            {/* ── 7. Reviews ────────────────────────────────────────── */}
            <ReviewsSection
              campId={camp.id}
              campName={camp.provider?.googleBusinessProfile?.businessName || camp.name}
              initialData={campReviews ?? undefined}
            />

            {/* ── 8. Safety & Supervision ───────────────────────────── */}
            {camp.safetySupervision &&
              (camp.safetySupervision.staffRatios?.length ||
                camp.safetySupervision.items?.length ||
                camp.safetySupervision.description) && (
                <section
                  id="safety"
                  className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
                >
                  <div className="flex items-center gap-2.5 mb-6">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-[26px] h-[26px] shrink-0 text-gray-900"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                      Safety &amp; Supervision
                    </h2>
                  </div>
                  <SafetyCard
                    ratios={camp.safetySupervision.staffRatios?.map((r: any) => ({
                      label: r.label,
                      ratio: r.value,
                    }))}
                    items={camp.safetySupervision.items}
                    description={camp.safetySupervision.description}
                  />
                </section>
              )}

            {/* ── 9. Accordion Group (Meals / Schedule / Screen Policy / Add-ons) */}
            <AccordionGroup
              meals={camp.meals}
              scheduleType={camp.scheduleType}
              dailySchedule={camp.dailySchedule}
              weeklySchedule={camp.weeklySchedule}
              screenPolicy={camp.screenPolicy}
              addOns={addOns}
            />

            {/* ── 10. Cancellation Policy ───────────────────────────── */}
            {camp.provider?.settings?.cancellationPolicy && (
              <CancellationPolicySection
                policy={camp.provider.settings.cancellationPolicy as any}
                customPolicy={camp.provider.settings.cancellationPolicyCustom}
                depositRequired={camp.provider.settings.depositRequired}
                depositType={camp.provider.settings.depositType}
                depositPercentage={camp.provider.settings.depositPercentage ?? undefined}
                depositFixedAmount={camp.provider.settings.depositFixedAmount ?? undefined}
                currency={currency}
                selectedSession={selectedSession}
              />
            )}

            {/* ── 11. Location & Campus ─────────────────────────────── */}
            <section id="location" className="mb-10 scroll-mt-14 md:mb-12 md:scroll-mt-16">
              <h2 className="text-[clamp(18px,3vw,24px)] font-bold text-gray-900 mb-6">
                Location &amp; campus
              </h2>

              {/* Campus size + setting pills */}
              {camp.campusFacilities &&
                (camp.campusFacilities.campusSize || camp.campusFacilities.campusSetting) && (
                  <div className="flex flex-wrap gap-2 mb-7">
                    {camp.campusFacilities.campusSize && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[13px] text-gray-700">
                        🏕️{' '}
                        {CAMPUS_SIZE.find(s => s.value === camp.campusFacilities?.campusSize)
                          ?.label || camp.campusFacilities.campusSize}
                      </span>
                    )}
                    {camp.campusFacilities.campusSetting && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[13px] text-gray-700">
                        🌿{' '}
                        {CAMPUS_SETTING.find(s => s.value === camp.campusFacilities?.campusSetting)
                          ?.label || camp.campusFacilities.campusSetting}
                      </span>
                    )}
                  </div>
                )}

              {/* Campus facilities */}
              {camp.campusFacilities?.selectedFacilities?.length ? (
                <div className="mb-7">
                  <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-gray-500 mb-[14px]">
                    Campus facilities
                  </p>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
                  >
                    {camp.campusFacilities.selectedFacilities.map((id: string) => {
                      const f = PREDEFINED_FACILITIES.find(f => f.id === id)
                      if (!f) return null
                      return (
                        <div key={id} className="flex items-center gap-2 text-[14px] text-gray-700">
                          <span className="text-[18px] shrink-0">{f.icon}</span>
                          {f.name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Map */}
              {(camp.locationLat && camp.locationLng) || camp.locationPlaceId ? (
                <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
                  <div className="h-[220px] w-full rounded-2xl overflow-hidden border border-gray-200 mb-2.5">
                    <GoogleMapWithSearch
                      selectedPlace={{
                        lat: camp.locationLat != null ? Number(camp.locationLat) : 0,
                        lng: camp.locationLng != null ? Number(camp.locationLng) : 0,
                        name: camp.locationName || camp.name,
                        placeId: camp.locationPlaceId ?? null,
                      }}
                    />
                  </div>
                </GoogleMapsLoader>
              ) : null}

              {/* Address + See full map link */}
              {camp.locationAddress && (
                <p className="text-[14px] text-gray-500 mb-1">{camp.locationAddress}</p>
              )}
              {(camp.locationLat && camp.locationLng) || camp.locationAddress ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(camp.locationAddress || `${camp.locationLat},${camp.locationLng}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-semibold text-secondary inline-flex items-center gap-1 mb-7"
                >
                  See full map
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M2 7h10M7 2l5 5-5 5" />
                  </svg>
                </a>
              ) : null}

              {/* Getting there */}
              {(() => {
                const gt = camp.gettingThere as any
                const selectedIds: string[] = gt?.selectedTransport ?? []
                const overallDescription: string = gt?.description ?? ''
                const transportDetails: Record<
                  string,
                  { description?: string; moreInfoUrl?: string }
                > = gt?.transportDetails ?? {}
                const transportItems = selectedIds
                  .map(id => PREDEFINED_TRANSPORT.find(t => t.id === id))
                  .filter(Boolean) as (typeof PREDEFINED_TRANSPORT)[number][]
                if (!transportItems.length && !overallDescription) return null
                return (
                  <>
                    <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-gray-500 mb-0">
                      Getting there
                    </p>
                    {overallDescription && (
                      <p className="text-[14px] text-gray-500 mt-3 mb-1 leading-relaxed">
                        {overallDescription}
                      </p>
                    )}
                    {transportItems.length > 0 && (
                      <div>
                        {transportItems.map(item => {
                          const detail = transportDetails[item.id] ?? {}
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0"
                            >
                              <span className="text-[22px] shrink-0 w-10 text-center">
                                {item.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[15px] font-semibold text-gray-900 mb-0.5">
                                  {item.name}
                                </div>
                                {detail.description && (
                                  <div className="text-[14px] text-gray-500">
                                    {detail.description}
                                  </div>
                                )}
                              </div>
                              {detail.moreInfoUrl && (
                                <a
                                  href={detail.moreInfoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[14px] font-medium text-secondary whitespace-nowrap shrink-0 hover:underline"
                                >
                                  More info
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })()}
            </section>

            {/* ── 12. About the Organizer ───────────────────────────── */}
            {camp.provider && (
              <ProviderSection
                provider={camp.provider}
                campId={camp.id}
                campSlug={camp.slug}
                campTitle={camp.name}
              />
            )}

            {/* ── 13. FAQ ───────────────────────────────────────────── */}
            <FaqSection items={faqItems} />
          </div>

          {/* ── Right: Sticky sidebar (desktop only) ─────────────── */}
          <CampSidebar
            camp={camp}
            sessions={activeSessions}
            currency={currency}
            selectedSession={selectedSession}
            onSessionSelect={setSelectedSession}
            onOpenSessionsModal={() => setIsSessionsModalOpen(true)}
          />
        </div>
      </div>

      {/* ── Sessions modal ─────────────────────────────────────────── */}
      <SessionsModal
        isOpen={isSessionsModalOpen}
        sessions={activeSessions}
        campName={camp.name}
        currency={currency}
        campAgeGroups={camp.ageGroups ?? []}
        campType={camp.type}
        campSlug={camp.slug}
        onClose={() => setIsSessionsModalOpen(false)}
        onSessionSelect={session => {
          setSelectedSession(session)
          setIsSessionsModalOpen(false)
        }}
      />

      {/* ── Mobile sticky footer ───────────────────────────────────── */}
      <MobileStickyFooter
        sessions={activeSessions}
        currency={currency}
        campSlug={camp.slug}
        campType={camp.type}
        selectedSession={selectedSession}
        onOpenSessionsModal={() => setIsSessionsModalOpen(true)}
        isAnyModalOpen={isAnyModalOpen}
      />
    </div>
  )
}

// ─── Module 01 — header rating stars (amber, 14px) ───────────────────────────

function HeaderRatingStars({ rating }: { rating: number }) {
  const rounded = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <span className="-space-x-0.5 flex items-center text-amber-500" aria-hidden>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={14}
          className={cn(
            'shrink-0',
            i <= rounded ? 'fill-amber-500 stroke-amber-500' : 'fill-transparent stroke-amber-500'
          )}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}
