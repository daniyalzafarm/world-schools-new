'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { ArrowLeft, CheckCircle2, MapPin, Search, Star } from 'lucide-react'
import { Input } from '@heroui/react'
import { useReviewsStore } from '@/stores/reviews-store'
import type { AttendedEligible, EligibleCampItem } from '@/services/reviews.services'

type FilterTab = 'all' | 'attended'

const CampCard = ({
  camp,
  attended,
  onSelect,
}: {
  camp: EligibleCampItem | AttendedEligible
  attended?: AttendedEligible['attended']
  onSelect: () => void
}) => {
  const campPhotos = camp.photos as { url?: string; isPrimary?: boolean }[] | null
  const imageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all',
        'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
        'hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-sm'
      )}
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={camp.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xl font-semibold">
            {camp.name[0]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{camp.name}</p>
        {camp.locationName && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {camp.locationName}
            </span>
          </div>
        )}
        {attended && (
          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            <CheckCircle2 size={11} />
            Attended{' '}
            {new Date(attended.date).toLocaleDateString('en-GB', {
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      <Star size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
    </div>
  )
}

const CampSelectorPage = () => {
  const router = useRouter()
  const { attended, allCamps, isEligibleLoading, fetchEligible } = useReviewsStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    void fetchEligible()
  }, [])

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

  const filteredAttended = useMemo(
    () =>
      attended.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.locationName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [attended, searchQuery]
  )

  const filteredAll = useMemo(
    () =>
      allCamps.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.locationName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [allCamps, searchQuery]
  )

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Camps', count: filteredAll.length },
    { key: 'attended', label: 'Attended', count: filteredAttended.length },
  ]

  return (
    <div className="pt-14 lg:pt-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <ArrowLeft size={18} className="text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Which camp do you want to review?
        </h1>
      </div>

      {/* Search */}
      <div className="mb-5">
        <Input
          placeholder="Search camps by name or location…"
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search size={16} className="text-slate-400 shrink-0" />}
          classNames={{
            inputWrapper:
              'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-none h-11',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-xs',
                activeTab === tab.key
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {isEligibleLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {!isEligibleLoading && (
        <>
          {/* Attended section */}
          {(activeTab === 'all' || activeTab === 'attended') && filteredAttended.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Camps You&apos;ve Attended
              </p>
              <div className="space-y-3">
                {filteredAttended.map(camp => (
                  <CampCard
                    key={camp.attended.bookingId}
                    camp={camp}
                    attended={camp.attended}
                    onSelect={() => handleSelect(camp.id, camp.attended)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All camps section */}
          {activeTab === 'all' && filteredAll.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Browse All Camps
              </p>
              <div className="space-y-3">
                {filteredAll.map(camp => (
                  <CampCard key={camp.id} camp={camp} onSelect={() => handleSelect(camp.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredAttended.length === 0 && filteredAll.length === 0 && (
            <div className="text-center py-16">
              <p className="text-base font-medium text-slate-900 dark:text-white mb-1">
                No camps found
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Try a different search term.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CampSelectorPage
