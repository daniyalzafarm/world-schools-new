'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Camp } from '@/types/camps'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { CampSearchPopover } from './camp-search-popover'

const SLOT_COUNT = 4

interface WishlistCompareTableProps {
  slots: (Camp | null)[]
  onSlotChange: (index: number, camp: Camp | null) => void
  readOnly?: boolean
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function firstPhotoUrl(camp: Camp): string | null {
  const photos = camp.photos
  if (!Array.isArray(photos) || photos.length === 0) return null
  const p = photos[0] as any
  return typeof p === 'string' ? p : (p?.url ?? null)
}

function getAgeRange(camp: Camp): string | null {
  const groups = camp.ageGroups as any
  if (!Array.isArray(groups) || groups.length === 0) return null
  const mins = groups.map((g: any) => g.min ?? g.minAge).filter((v: any) => v != null)
  const maxs = groups.map((g: any) => g.max ?? g.maxAge).filter((v: any) => v != null)
  if (!mins.length) return null
  return `${Math.min(...mins)}–${Math.max(...maxs)} years`
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="table-row">
      <span className="table-cell px-4 py-2.5 bg-slate-800 text-white text-xs font-semibold uppercase tracking-[0.5px]">
        {label}
      </span>
      {Array.from({ length: SLOT_COUNT }).map((_, i) => (
        <span key={i} className="table-cell px-4 py-2.5 bg-slate-800" />
      ))}
    </div>
  )
}

function DataRow({ label, values }: { label: string; values: React.ReactNode[] }) {
  const paddedValues = Array.from({ length: SLOT_COUNT }, (_, i) => values[i] ?? null)
  return (
    <div className="table-row">
      <div className="table-cell py-3.5 px-4 text-sm font-medium text-gray-500 bg-gray-50 border-b border-gray-100 w-28 max-w-28 align-middle">
        {label}
      </div>
      {paddedValues.map((val, i) => (
        <div
          key={i}
          className="table-cell py-3.5 px-4 border-b border-l border-gray-100 text-sm align-top"
        >
          {val ?? <span className="text-gray-300">—</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Activities with expand/collapse ─────────────────────────────────────────

function ActivitiesList({ activities }: { activities: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const INITIAL_COUNT = 4
  const visible = expanded ? activities : activities.slice(0, INITIAL_COUNT)
  const hiddenCount = activities.length - INITIAL_COUNT

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((a, i) => (
        <span
          key={i}
          className="px-2.5 py-1 bg-gray-100 text-slate-800 rounded-md text-xs font-medium"
        >
          {a}
        </span>
      ))}
      {hiddenCount > 0 && (
        <button
          className="px-2.5 py-1 bg-emerald-50 text-teal-600 rounded-md text-xs font-medium hover:bg-emerald-100 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < full || (i === full && half) ? 'fill-primary text-primary' : 'fill-gray-200 text-gray-200'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

// ─── Empty slot ───────────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
      <svg
        className="w-7 h-7 text-gray-300 mb-1.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <p className="text-xs text-gray-400">Search a camp above</p>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function WishlistCompareTable({
  slots,
  onSlotChange,
  readOnly = false,
}: WishlistCompareTableProps) {
  const router = useRouter()
  const { openAddToWishlistModal, myWishlists, isCampInWishlist } = useWishlistsStore()
  function isCampWishlisted(camp: Camp): boolean {
    return myWishlists.some(w => isCampInWishlist(w.id, camp.id))
  }

  function handleWishlistClick(camp: Camp) {
    openAddToWishlistModal(camp.id, {
      name: camp.name,
      thumbnail: firstPhotoUrl(camp),
      location: camp.locationName ?? null,
    })
  }

  const paddedSlots: (Camp | null)[] = Array.from(
    { length: SLOT_COUNT },
    (_, i) => slots[i] ?? null
  )

  // ── Section visibility helpers ────────────────────────────────────────────
  const hasAnyAccommodation = paddedSlots.some(c => (c as any)?.accommodation)
  const hasAnyMeals = paddedSlots.some(c => (c as any)?.meals)
  const hasAnyIncluded = paddedSlots.some(c => {
    const wi = (c as any)?.whatsIncluded
    return wi?.items?.length > 0 || wi?.customItems?.length > 0
  })
  const hasAnySchedule = paddedSlots.some(c => {
    if (!c) return false
    return c.scheduleType === 'daily'
      ? (c.dailySchedule?.timeSlots?.length ?? 0) > 0
      : c.scheduleType === 'weekly'
  })
  const hasAnyActivities = paddedSlots.some(c => (c?.activities?.length ?? 0) > 0)
  const hasAnyReviews = paddedSlots.some(c => (c as any)?.provider?.googleBusinessProfile?.rating)

  return (
    <div className="overflow-x-auto">
      <div className="table border-collapse w-max min-w-full">
        {/* ── Camp header row ──────────────────────────────────────────── */}
        <div className="table-row">
          <div className="table-cell py-5 px-4 bg-white align-top w-28 max-w-28" />
          {paddedSlots.map((camp, i) => (
            <div
              key={i}
              className="table-cell py-5 px-4 border-l border-gray-100 w-72 min-w-64 max-w-72 align-top"
            >
              {/* Search bar */}
              {!readOnly && (
                <div className="mb-3">
                  <CampSearchPopover
                    currentCamp={camp}
                    onSelect={c => onSlotChange(i, c)}
                    placeholder="Search camps…"
                  />
                </div>
              )}

              {camp ? (
                <>
                  {/* Photo */}
                  <div className="relative h-40 rounded-xl overflow-hidden mb-3.5">
                    {firstPhotoUrl(camp) ? (
                      <img
                        src={firstPhotoUrl(camp)!}
                        alt={camp.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300" />
                    )}
                    {!readOnly && (
                      <button
                        className="cursor-pointer absolute top-2.5 right-2.5 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:scale-105 transition-transform"
                        onClick={() => handleWishlistClick(camp)}
                        title="Add to wishlist"
                      >
                        {isCampWishlisted(camp) ? (
                          <svg className="w-5 h-5 fill-red-500 text-red-500" viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Name */}
                  <div
                    className="text-base font-semibold mb-1.5 cursor-pointer hover:text-teal-600 transition-colors leading-snug"
                    onClick={() => router.push(`/camps/${camp.slug}`)}
                  >
                    {camp.name}
                  </div>

                  {/* Location */}
                  {camp.locationName && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-1.5">
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {camp.locationName}
                    </div>
                  )}

                  {/* Rating + type */}
                  <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                    {(() => {
                      const gbp = (camp as any)?.provider?.googleBusinessProfile
                      return gbp?.rating ? (
                        <span className="flex items-center gap-1 text-slate-800 font-medium">
                          <StarRating rating={gbp.rating} />
                          {gbp.rating}
                          {gbp.reviewsCount ? ` (${gbp.reviewsCount})` : ''}
                        </span>
                      ) : null
                    })()}
                    {camp.type && (
                      <>
                        {(camp as any)?.provider?.googleBusinessProfile?.rating && <span>•</span>}
                        <span>{camp.type}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <EmptySlot />
              )}
            </div>
          ))}
        </div>

        {/* ── Key Facts ─────────────────────────────────────────────────── */}
        <SectionHeader label="Key Facts" />

        <DataRow
          label="Founded"
          values={paddedSlots.map(camp => {
            if (!camp) return null
            const year = (camp as any)?.provider?.yearFounded
            if (!year) return null
            const exp = new Date().getFullYear() - year
            return (
              <div key={camp.id}>
                <div className="font-semibold text-slate-800">{year}</div>
                <div className="text-xs text-gray-500 mt-0.5">{exp} years experience</div>
              </div>
            )
          })}
        />

        <DataRow
          label="Ages"
          values={paddedSlots.map(camp => {
            const range = camp ? getAgeRange(camp) : null
            return range ? <div className="font-semibold text-slate-800">{range}</div> : null
          })}
        />

        <DataRow
          label="Languages"
          values={paddedSlots.map(camp => {
            if (!camp?.languages?.length) return null
            return (
              <div key={camp.id} className="flex flex-wrap gap-1">
                {camp.languages.map(lang => (
                  <span
                    key={lang}
                    className="px-2.5 py-1 bg-gray-100 text-slate-800 rounded-md text-xs font-medium capitalize"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            )
          })}
        />

        <DataRow
          label="Gender"
          values={paddedSlots.map(camp =>
            camp?.gender ? (
              <span
                key={camp.id}
                className="px-2.5 py-1 bg-gray-100 text-slate-800 rounded-md text-xs font-medium capitalize"
              >
                {camp.gender}
              </span>
            ) : null
          )}
        />

        {/* ── Accommodation ─────────────────────────────────────────────── */}
        {hasAnyAccommodation && (
          <>
            <SectionHeader label="Accommodation" />
            <DataRow
              label="Rooms"
              values={paddedSlots.map(camp => {
                if (!camp) return null
                const acc = (camp as any)?.accommodation
                if (!acc) return null
                return (
                  <div key={camp.id}>
                    {acc.rooms && <div className="font-semibold text-slate-800">{acc.rooms}</div>}
                    {acc.type && (
                      <div className="text-xs text-gray-500 mt-0.5 capitalize">{acc.type}</div>
                    )}
                  </div>
                )
              })}
            />
          </>
        )}

        {/* ── Meals ─────────────────────────────────────────────────────── */}
        {hasAnyMeals && (
          <>
            <SectionHeader label="Meals" />
            <DataRow
              label="Meals"
              values={paddedSlots.map(camp => {
                const m = (camp as any)?.meals
                if (!m) return null
                const parts: string[] = []
                if (m.breakfast) parts.push('Breakfast')
                if (m.lunch) parts.push('Lunch')
                if (m.dinner) parts.push('Dinner')
                if (m.snacks) parts.push('Snacks')
                return parts.length ? (
                  <div className="font-semibold text-slate-800">{parts.join(' + ')}</div>
                ) : null
              })}
            />
            <DataRow
              label="Dietary options"
              values={paddedSlots.map(camp => {
                if (!camp) return null
                const dietary: string[] = (camp as any)?.meals?.dietary ?? []
                if (!dietary.length) return null
                return (
                  <div key={camp.id} className="flex flex-wrap gap-1">
                    {dietary.map(d => (
                      <span
                        key={d}
                        className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-medium"
                      >
                        ✓ {d}
                      </span>
                    ))}
                  </div>
                )
              })}
            />
          </>
        )}

        {/* ── What's Included ───────────────────────────────────────────── */}
        {hasAnyIncluded && (
          <>
            <SectionHeader label="What's Included" />
            <DataRow
              label="Included"
              values={paddedSlots.map(camp => {
                if (!camp) return null
                const wi = (camp as any)?.whatsIncluded
                if (!wi) return null
                const items: string[] = [...(wi.items ?? []), ...(wi.customItems ?? [])]
                if (!items.length) return null
                return (
                  <div key={camp.id} className="flex flex-wrap gap-1.5">
                    {items.map(item => (
                      <span
                        key={item}
                        className="px-2.5 py-1 bg-gray-100 text-slate-800 rounded-md text-xs font-medium"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                )
              })}
            />
          </>
        )}

        {/* ── Daily Schedule ────────────────────────────────────────────── */}
        {hasAnySchedule && (
          <>
            <SectionHeader label="Daily Schedule" />
            <DataRow
              label="Typical day"
              values={paddedSlots.map(camp => {
                if (!camp) return null
                const slots =
                  camp.scheduleType === 'daily'
                    ? (camp.dailySchedule?.timeSlots ?? [])
                    : camp.scheduleType === 'weekly'
                      ? (camp.weeklySchedule?.monday?.timeSlots ?? [])
                      : []
                if (!slots.length) return null
                return (
                  <div key={camp.id} className="flex flex-col gap-1">
                    {slots.map((s, idx) => (
                      <div key={idx} className="flex gap-2.5 text-sm">
                        <span className="text-gray-400 min-w-10 shrink-0">{s.time}</span>
                        <span>{s.activity}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            />
          </>
        )}

        {/* ── Activities ────────────────────────────────────────────────── */}
        {hasAnyActivities && (
          <>
            <SectionHeader label="Activities" />
            <DataRow
              label="Main activities"
              values={paddedSlots.map(camp => {
                if (!camp?.activities?.length) return null
                return <ActivitiesList key={camp.id} activities={camp.activities} />
              })}
            />
          </>
        )}

        {/* ── Reviews ───────────────────────────────────────────────────── */}
        {hasAnyReviews && (
          <>
            <SectionHeader label="Reviews" />
            <DataRow
              label="Rating"
              values={paddedSlots.map(camp => {
                if (!camp) return null
                const gbp = (camp as any)?.provider?.googleBusinessProfile
                if (!gbp?.rating) return null
                return (
                  <div key={camp.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <StarRating rating={gbp.rating} />
                      <span className="text-sm font-semibold text-slate-800">{gbp.rating}</span>
                      {gbp.reviewsCount && (
                        <span className="text-xs text-gray-500">({gbp.reviewsCount} reviews)</span>
                      )}
                    </div>
                    {gbp.businessName && (
                      <div className="text-xs text-gray-500">{gbp.businessName}</div>
                    )}
                  </div>
                )
              })}
            />
          </>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <SectionHeader label="Actions" />
        <div className="table-row">
          <div className="table-cell py-3.5 px-4 bg-gray-50 border-b border-gray-100 align-middle" />
          {paddedSlots.map((camp, i) => (
            <div
              key={i}
              className="table-cell py-3.5 px-4 border-b border-l border-gray-100 align-top"
            >
              {camp ? (
                <div className="flex flex-col gap-2.5">
                  <button
                    className="w-full py-3.5 bg-primary rounded-xl text-sm font-semibold text-slate-800 hover:bg-emerald-400 transition-colors"
                    onClick={() => router.push(`/camps/${camp.slug}`)}
                  >
                    Book
                  </button>
                  <button
                    className="w-full py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-slate-800 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-slate-800 transition-colors"
                    onClick={() => router.push(`/messages?camp=${camp.slug}`)}
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Message camp
                  </button>
                  {!readOnly && (
                    <button
                      className={`w-full py-2.5 bg-white border rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors ${
                        isCampWishlisted(camp)
                          ? 'border-red-200 text-red-500 hover:bg-red-50'
                          : 'border-gray-200 text-gray-500 hover:border-slate-800 hover:text-slate-800 hover:bg-gray-50'
                      }`}
                      onClick={() => handleWishlistClick(camp)}
                    >
                      {isCampWishlisted(camp) ? (
                        <svg className="w-4 h-4 fill-red-500" viewBox="0 0 24 24">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      )}
                      {isCampWishlisted(camp) ? 'Wishlisted' : 'Add to wishlist'}
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-gray-300 text-sm">—</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
