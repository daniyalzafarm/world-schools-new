'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { cn, Input } from '@world-schools/ui-web'
import { Search } from 'lucide-react'
import { UPCOMING_STATUSES } from '@world-schools/wc-frontend-utils'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { useReviewsStore } from '@/stores/reviews-store'
import type { AttendedEligible, EligibleCampItem } from '@/services/reviews.services'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { WriteReviewCampSelectCard } from '@/components/reviews/write-review-camp-select-card'

type FilterTab = 'all' | 'attended' | 'upcoming' | 'past'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Camps' },
  { key: 'attended', label: 'Attended' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past Bookings' },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="mb-1 text-base font-semibold text-default-900 dark:text-white">{title}</h2>
      <p className="text-sm text-default-500 dark:text-slate-400">{subtitle}</p>
    </div>
  )
}

function CampListSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
      {[0, 1].map(i => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-default-100 p-3 dark:border-slate-800 md:flex-col"
        >
          <div className="size-24 shrink-0 animate-pulse rounded-lg bg-default-200 dark:bg-slate-700 md:h-44 md:w-full" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <div className="h-4 w-3/4 max-w-xs animate-pulse rounded bg-default-200 dark:bg-slate-700" />
            <div className="h-3 w-3/5 max-w-xs animate-pulse rounded bg-default-200 dark:bg-slate-700" />
            <div className="h-3 w-1/2 max-w-xs animate-pulse rounded bg-default-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  )
}

const CampSelectorPage = () => {
  const router = useRouter()
  const { attended, allCamps, isEligibleLoading, fetchEligible } = useReviewsStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [bookingGroups, setBookingGroups] = useState<ParentBookingGroupSummary[] | null>(null)

  useEffect(() => {
    void fetchEligible()
  }, [fetchEligible])

  useEffect(() => {
    void bookingGroupsService.list().then(res => {
      if (res.success && res.data) setBookingGroups(res.data)
      else setBookingGroups([])
    })
  }, [])

  const campById = useMemo(() => new Map(allCamps.map(c => [c.id, c])), [allCamps])

  const upcomingCampItems: EligibleCampItem[] = useMemo(() => {
    if (!bookingGroups?.length) return []
    const groups = bookingGroups.filter(g => UPCOMING_STATUSES.includes(g.status))
    const seen = new Set<string>()
    const out: EligibleCampItem[] = []
    for (const g of groups) {
      const id = g.camp.id
      if (seen.has(id)) continue
      seen.add(id)
      const full = campById.get(id)
      if (full) {
        out.push(full)
      } else {
        out.push({
          id: g.camp.id,
          name: g.camp.name,
          locationName: null,
          photos: g.camp.coverImageUrl
            ? ([{ url: g.camp.coverImageUrl, isPrimary: true }] as unknown)
            : undefined,
          slug: g.camp.slug,
          reviewCount: 0,
          avgRating: null,
        })
      }
    }
    return out
  }, [bookingGroups, campById])

  const q = searchQuery.trim().toLowerCase()

  const filteredAttended = useMemo(() => {
    if (!q) return attended
    return attended.filter(
      c => c.name.toLowerCase().includes(q) || (c.locationName ?? '').toLowerCase().includes(q)
    )
  }, [attended, q])

  const filteredAll = useMemo(() => {
    if (!q) return allCamps
    return allCamps.filter(
      c => c.name.toLowerCase().includes(q) || (c.locationName ?? '').toLowerCase().includes(q)
    )
  }, [allCamps, q])

  const filteredUpcoming = useMemo(() => {
    if (!q) return upcomingCampItems
    return upcomingCampItems.filter(
      c => c.name.toLowerCase().includes(q) || (c.locationName ?? '').toLowerCase().includes(q)
    )
  }, [upcomingCampItems, q])

  const handleSelect = (campId: string, attendedData?: AttendedEligible['attended']) => {
    if (attendedData) {
      const params = new URLSearchParams({
        bookingGroupId: attendedData.bookingGroupId,
        bookingId: attendedData.bookingId,
      })
      router.push(`/reviews/write/${campId}?${params.toString()}`)
    } else {
      router.push(`/reviews/write/${campId}`)
    }
  }

  const attendedSectionTitle =
    activeTab === 'past'
      ? { title: 'Past Bookings', subtitle: "All camps you've previously attended" }
      : { title: "Camps You've Attended", subtitle: 'Based on your booking history' }

  const browseSectionTitle =
    activeTab === 'upcoming'
      ? { title: 'Upcoming Camps', subtitle: 'Camps you have booked' }
      : { title: 'Browse All Camps', subtitle: 'Find any camp to review' }

  const showAttendedBlock = activeTab === 'all' || activeTab === 'attended' || activeTab === 'past'
  const showBrowseBlock = activeTab === 'all' || activeTab === 'upcoming'
  const browseList: EligibleCampItem[] = activeTab === 'upcoming' ? filteredUpcoming : filteredAll

  const attendedVisible = showAttendedBlock && filteredAttended.length > 0
  const browseVisible = showBrowseBlock && browseList.length > 0

  const hasMatchingCards = useMemo(() => {
    if (activeTab === 'all') {
      return filteredAttended.length > 0 || filteredAll.length > 0
    }
    if (activeTab === 'attended' || activeTab === 'past') {
      return filteredAttended.length > 0
    }
    if (activeTab === 'upcoming') {
      return filteredUpcoming.length > 0
    }
    return false
  }, [activeTab, filteredAll.length, filteredAttended.length, filteredUpcoming.length])

  const showSearchEmpty = Boolean(q) && !isEligibleLoading && !hasMatchingCards

  const showDivider = activeTab === 'all' && attendedVisible && browseVisible && !showSearchEmpty

  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-default-900 dark:text-white md:text-3xl">
          Which camp do you want to review?
        </h2>
        <p className="text-base leading-relaxed text-default-500 dark:text-slate-400">
          Select a camp you&apos;ve attended to share your experience with other families.
        </p>
      </section>

      <div className="relative mb-6">
        <Input
          placeholder="Search camps..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search className="size-4 shrink-0 text-default-500" aria-hidden />}
          classNames={{
            inputWrapper: cn(
              'h-12 min-h-12 rounded-xl border-default-200 bg-white py-0 shadow-none',
              'dark:border-slate-600 dark:bg-slate-900'
            ),
            input: 'text-base pl-1',
          }}
        />
      </div>

      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'cursor-pointer shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-default-900 bg-default-900 text-white dark:border-white dark:bg-white dark:text-default-900'
                : 'border-default-200 bg-white text-default-900 hover:border-default-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:border-slate-400'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isEligibleLoading ? (
        <CampListSkeleton />
      ) : showSearchEmpty ? (
        <div className="px-4 py-16 text-center sm:px-6">
          <Search className="mx-auto mb-4 size-16 text-default-300 dark:text-slate-600" />
          <h3 className="mb-2 text-lg font-semibold text-default-900 dark:text-white">
            No camps found
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-default-500 dark:text-slate-400">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
          <Button color="primary" onPress={() => setSearchQuery('')}>
            Clear Search
          </Button>
        </div>
      ) : (
        <>
          {showAttendedBlock && attendedVisible ? (
            <>
              <SectionHeader
                title={attendedSectionTitle.title}
                subtitle={attendedSectionTitle.subtitle}
              />
              <div className="mb-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
                {filteredAttended.map(camp => (
                  <WriteReviewCampSelectCard
                    key={camp.attended.bookingId}
                    camp={camp}
                    attended={camp.attended}
                    onSelect={() => handleSelect(camp.id, camp.attended)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {showDivider ? (
            <div className="my-8 h-2 bg-default-100 dark:bg-slate-800" role="presentation" />
          ) : null}

          {showBrowseBlock && browseVisible ? (
            <>
              <SectionHeader
                title={browseSectionTitle.title}
                subtitle={browseSectionTitle.subtitle}
              />
              <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
                {browseList.map(camp => (
                  <WriteReviewCampSelectCard
                    key={camp.id}
                    camp={camp}
                    onSelect={() => handleSelect(camp.id)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {!showSearchEmpty && !attendedVisible && !browseVisible && !isEligibleLoading ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-default-900 dark:text-white">
                No camps found
              </p>
              <p className="mt-2 text-sm text-default-500 dark:text-slate-400">
                Try a different search term or filter.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default CampSelectorPage
