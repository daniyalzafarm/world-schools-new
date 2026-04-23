'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Session } from '@/types/sessions'
import type { AgeGroup, CampType, SessionType } from '@/types/camps'
import { formatCurrency } from '@/utils/currency'

const PREVIEW_COUNT = 3

interface SessionsSectionProps {
  sessions: Session[]
  sessionType?: SessionType | null
  campName: string
  currency?: string
  ageGroups?: AgeGroup[]
  campType?: CampType
  campSlug: string
  selectedSession?: Session | null
  onSelectSession?: (session: Session | null) => void
  onOpenSessionsModal?: () => void
}

function getSessionAgeLabel(
  session: Session,
  campAgeGroups: AgeGroup[],
  campAgeLabel: string | null
): string | null {
  if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
    const ids = session.ageGroupPrices.map(p => p.ageGroupId)
    const groups = campAgeGroups.filter(g => g.id && ids.includes(g.id))
    if (groups.length > 0 && groups.length < campAgeGroups.length) {
      return `Ages ${Math.min(...groups.map(g => g.min))}–${Math.max(...groups.map(g => g.max))}`
    }
  }
  return campAgeLabel
}

function fmtDateRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return sameYear ? `${startStr}–${endStr}, ${end.getFullYear()}` : `${startStr}–${endStr}`
}

function fmtDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export function SessionsSection({
  sessions,
  campName: _campName,
  currency = 'USD',
  ageGroups = [],
  campType = 'day',
  campSlug,
  selectedSession,
  onSelectSession,
  onOpenSessionsModal,
}: SessionsSectionProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('any')
  const [selectedAge, setSelectedAge] = useState<string>('any')

  if (!sessions?.length) return null

  const monthKeys = Array.from(
    new Set(
      sessions.map(s =>
        new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      )
    )
  )

  const sessionCountByMonth = monthKeys.reduce<Record<string, number>>((acc, m) => {
    acc[m] = sessions.filter(
      s =>
        new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === m
    ).length
    return acc
  }, {})

  const ageGroupOptions =
    ageGroups.length > 1
      ? ageGroups.map(g => ({ id: g.id ?? `${g.min}-${g.max}`, label: `Ages ${g.min}–${g.max}` }))
      : []

  const filteredSessions = sessions.filter(s => {
    const monthMatch =
      selectedMonth === 'any' ||
      new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) ===
        selectedMonth
    const ageMatch =
      selectedAge === 'any' ||
      (s.pricingType === 'age_group'
        ? s.ageGroupPrices?.some((agp: any) => agp.ageGroupId === selectedAge)
        : true)
    return monthMatch && ageMatch
  })

  const previewSessions = filteredSessions.slice(0, PREVIEW_COUNT)
  const hasMore = filteredSessions.length > PREVIEW_COUNT

  const campAgeLabel =
    ageGroups.length > 0
      ? `Ages ${Math.min(...ageGroups.map(g => g.min))}–${Math.max(...ageGroups.map(g => g.max))}`
      : null

  return (
    <section
      id="sessions"
      className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
    >
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Dates &amp; Pricing</h2>

      {/* Filters */}
      {(monthKeys.length > 1 || ageGroupOptions.length > 0) && (
        <div className="-mx-5 sm:-mx-8 lg:mx-0 px-5 sm:px-8 lg:px-0 flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 mb-5 md:flex-wrap md:overflow-visible">
          {monthKeys.map(month => (
            <button
              key={month}
              onClick={() => setSelectedMonth(selectedMonth === month ? 'any' : month)}
              className={`shrink-0 inline-flex items-center gap-0.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                selectedMonth === month
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              {month.split(' ')[0]}
              <span
                className={`text-xs font-normal ${selectedMonth === month ? 'opacity-60' : 'text-gray-400'}`}
              >
                ({sessionCountByMonth[month]})
              </span>
            </button>
          ))}

          {ageGroupOptions.length > 0 && (
            <div className="w-px bg-gray-200 self-stretch shrink-0 mx-0.5" />
          )}

          {ageGroupOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedAge(selectedAge === opt.id ? 'any' : opt.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                selectedAge === opt.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Session cards */}
      <div className="flex flex-col gap-2">
        {previewSessions.map(session => (
          <div key={session.id}>
            {/* Mobile — selectable card */}
            <div className="sm:hidden">
              <SessionRadioCard
                session={session}
                currency={currency}
                campAgeGroups={ageGroups}
                campAgeLabel={campAgeLabel}
                campType={campType}
                campSlug={campSlug}
                selected={selectedSession?.id === session.id}
                onSelect={id => {
                  const s = sessions.find(s => s.id === id) ?? null
                  onSelectSession?.(selectedSession?.id === id ? null : s)
                }}
              />
            </div>
            {/* Desktop — clickable card */}
            <div className="hidden sm:block">
              <SessionCard
                session={session}
                currency={currency}
                campAgeGroups={ageGroups}
                campAgeLabel={campAgeLabel}
                campType={campType}
                campSlug={campSlug}
                selected={selectedSession?.id === session.id}
              />
            </div>
          </div>
        ))}
        {filteredSessions.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            No sessions match your filter.
          </div>
        )}
      </div>

      {/* See all button */}
      {hasMore && onOpenSessionsModal && (
        <button
          onClick={onOpenSessionsModal}
          className="mt-4 w-full md:w-auto md:px-6 py-3.5 border-2 border-primary bg-primary/10 text-secondary text-sm font-bold rounded-xl text-center hover:bg-primary/20 transition-colors"
        >
          See all {filteredSessions.length} sessions →
        </button>
      )}
    </section>
  )
}

// ─── Shared session card logic ────────────────────────────────────────────────

function getSessionCardData(
  session: Session,
  currency: string,
  campAgeGroups: AgeGroup[],
  campAgeLabel: string | null,
  campType: CampType
) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const unit = campType === 'residential' ? 'night' : 'day'
  const durationLabel = `${diffDays} ${unit}${diffDays !== 1 ? 's' : ''}`
  const startDayName = fmtDayName(startDate)
  const endDayName = fmtDayName(endDate)

  const spotsLeft =
    session.totalSpots != null && session.bookedCount != null
      ? session.totalSpots - session.bookedCount
      : (session.totalSpots ?? null)
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0
  const isFewSpots = !isSoldOut && spotsLeft !== null && spotsLeft <= 5

  const price =
    session.pricingType === 'single' && session.price !== undefined
      ? session.price
      : session.pricingType === 'age_group' && session.ageGroupPrices?.length
        ? Math.min(...session.ageGroupPrices.map(a => a.price))
        : 0
  const ageLabel = getSessionAgeLabel(session, campAgeGroups, campAgeLabel)
  const dateRange = fmtDateRange(startDate, endDate)

  return {
    startDate,
    endDate,
    durationLabel,
    startDayName,
    endDayName,
    spotsLeft,
    isSoldOut,
    isFewSpots,
    price,
    ageLabel,
    dateRange,
    formattedPrice: formatCurrency(price, currency),
  }
}

// ─── Desktop session card ─────────────────────────────────────────────────────

function SessionCard({
  session,
  currency,
  campAgeGroups,
  campAgeLabel,
  campType,
  campSlug,
  selected,
}: {
  session: Session
  currency: string
  campAgeGroups: AgeGroup[]
  campAgeLabel: string | null
  campType: CampType
  campSlug: string
  selected?: boolean
}) {
  const {
    durationLabel,
    startDayName,
    endDayName,
    isSoldOut,
    isFewSpots,
    spotsLeft,
    ageLabel,
    dateRange,
    formattedPrice,
  } = getSessionCardData(session, currency, campAgeGroups, campAgeLabel, campType)

  const className = [
    'no-underline border-2 rounded-xl px-4 py-4 transition-all flex items-center gap-4',
    isSoldOut
      ? 'opacity-40 cursor-not-allowed pointer-events-none border-gray-200 bg-white'
      : selected
        ? 'border-gray-900 bg-gray-50 shadow-sm cursor-pointer'
        : isFewSpots
          ? 'bg-white border-amber-800/30 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm cursor-pointer'
          : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm cursor-pointer',
  ].join(' ')

  const body = (
    <>
      {/* Left: date + meta + pills */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-lg font-extrabold leading-tight mb-1 ${
            isSoldOut ? 'line-through text-gray-400' : 'text-gray-900'
          }`}
        >
          {session.name || dateRange}
        </p>
        {session.name && <p className="text-sm text-gray-500 mb-1 leading-snug">{dateRange}</p>}
        <div className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 mb-2">
          <span>
            {startDayName} → {endDayName}
          </span>
          <span className="text-gray-300 text-xs">·</span>
          <span>{durationLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ageLabel && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-emerald-700">
              {ageLabel}
            </span>
          )}
          {isFewSpots && spotsLeft !== null && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              ⚡ {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </span>
          )}
          {isSoldOut && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Sold out
            </span>
          )}
        </div>
      </div>

      {/* Right: price */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <p className="text-xs text-gray-400 leading-none">from</p>
        <p
          className={`text-xl font-extrabold leading-tight whitespace-nowrap ${
            isSoldOut ? 'line-through text-gray-400' : 'text-gray-900'
          }`}
        >
          {formattedPrice}
        </p>
        <p className="text-sm text-gray-400 leading-none">/ {durationLabel}</p>
      </div>
    </>
  )

  if (isSoldOut) return <div className={className}>{body}</div>
  return (
    <Link href={`/camps/${campSlug}/book?sessionId=${session.id}`} className={className}>
      {body}
    </Link>
  )
}

// ─── Mobile radio card ────────────────────────────────────────────────────────

function SessionRadioCard({
  session,
  currency,
  campAgeGroups,
  campAgeLabel,
  campType,
  campSlug: _campSlug,
  selected,
  onSelect,
}: {
  session: Session
  currency: string
  campAgeGroups: AgeGroup[]
  campAgeLabel: string | null
  campType: CampType
  campSlug: string
  selected: boolean
  onSelect: (id: string) => void
}) {
  const {
    durationLabel,
    startDayName,
    endDayName,
    isSoldOut,
    isFewSpots,
    spotsLeft,
    ageLabel,
    dateRange,
    formattedPrice,
  } = getSessionCardData(session, currency, campAgeGroups, campAgeLabel, campType)

  const radioDot = (
    <div
      className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
        selected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
      }`}
    >
      {selected && <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
  )

  return (
    <div
      onClick={() => !isSoldOut && onSelect(session.id)}
      className={[
        'border-2 rounded-xl px-4 py-4 bg-white transition-all',
        isSoldOut
          ? 'opacity-40 cursor-not-allowed pointer-events-none border-gray-200'
          : selected
            ? 'border-gray-900 bg-gray-50 shadow-sm cursor-pointer'
            : isFewSpots
              ? 'border-amber-800/30 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm cursor-pointer'
              : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm cursor-pointer',
      ].join(' ')}
    >
      {/* Row 1: date heading + radio */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <p
          className={`text-lg font-extrabold leading-tight flex-1 ${
            isSoldOut ? 'line-through text-gray-400' : 'text-gray-900'
          }`}
        >
          {session.name || dateRange}
        </p>
        {radioDot}
      </div>
      {session.name && <p className="text-sm text-gray-500 mb-1 leading-snug">{dateRange}</p>}
      {/* Meta row */}
      <div className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 mb-2">
        <span>
          {startDayName} → {endDayName}
        </span>
        <span className="text-gray-300 text-xs">·</span>
        <span>{durationLabel}</span>
      </div>
      {/* Bottom: pills + price */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ageLabel && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-emerald-700">
              {ageLabel}
            </span>
          )}
          {isFewSpots && spotsLeft !== null && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              ⚡ {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </span>
          )}
          {isSoldOut && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Sold out
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-400 leading-none mb-0.5">from</p>
          <p
            className={`text-xl font-extrabold leading-tight whitespace-nowrap ${
              isSoldOut ? 'line-through text-gray-400' : 'text-gray-900'
            }`}
          >
            {formattedPrice}
          </p>
          <p className="text-sm text-gray-400 leading-none">/ {durationLabel}</p>
        </div>
      </div>
    </div>
  )
}
