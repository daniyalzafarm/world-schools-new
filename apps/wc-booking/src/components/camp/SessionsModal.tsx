'use client'

import { useState } from 'react'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import type { Session } from '../../types/sessions'
import type { AgeGroup, CampType } from '../../types/camps'
import { formatCurrency } from '../../utils/currency'

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

function abbreviateMonth(monthKey: string): string {
  const [month, year] = monthKey.split(' ')
  return `${month.slice(0, 3)} ${year}`
}

interface SessionsModalProps {
  isOpen: boolean
  sessions: Session[]
  campName: string
  currency: string
  campAgeGroups: AgeGroup[]
  campType: CampType
  campSlug: string
  onClose: () => void
  onSessionSelect: (session: Session) => void
}

export function SessionsModal({
  isOpen,
  sessions,
  campName: _campName,
  currency,
  campAgeGroups,
  campType,
  campSlug,
  onClose,
  onSessionSelect,
}: SessionsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('any')
  const [selectedAgeId, setSelectedAgeId] = useState<string>('any')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const campAgeLabel =
    campAgeGroups.length > 0
      ? `Ages ${Math.min(...campAgeGroups.map(g => g.min))}–${Math.max(...campAgeGroups.map(g => g.max))}`
      : null

  const monthKeys = Array.from(
    new Set(
      sessions.map(s =>
        new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      )
    )
  )

  const sessionAgeGroupIds = Array.from(
    new Set(sessions.flatMap(s => s.ageGroupPrices?.map(p => p.ageGroupId) ?? []))
  )
  const ageGroupOptions = campAgeGroups.filter(g => g.id && sessionAgeGroupIds.includes(g.id))
  const showAgeFilter = ageGroupOptions.length > 1

  const filteredSessions = sessions.filter(s => {
    if (
      selectedMonth !== 'any' &&
      new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) !==
        selectedMonth
    )
      return false
    if (selectedAgeId !== 'any') {
      if (s.pricingType === 'single') return true
      if (!s.ageGroupPrices?.some(p => p.ageGroupId === selectedAgeId)) return false
    }
    return true
  })

  const selectedSession = sessions.find(s => s.id === selectedId) ?? null

  const handleReserve = () => {
    if (selectedSession) {
      onSessionSelect(selectedSession)
      onClose()
    }
  }

  const pillClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-[13px] font-semibold border-[1.5px] transition-all ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-900'
    }`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton
      scrollBehavior="inside"
      classNames={{
        base: 'mx-0 my-0 sm:mx-0 sm:my-0 rounded-t-[20px] rounded-b-none sm:rounded-[20px] sm:max-w-[600px] max-h-[80svh] sm:max-h-[580px] bg-white',
        backdrop: 'bg-black/50',
      }}
    >
      <ModalContent>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <ModalHeader className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Dates &amp; pricing</h2>
          <button
            onClick={onClose}
            className="cursor-pointer w-9 h-9 rounded-full border-[1.5px] border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:opacity-60 transition-opacity"
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </ModalHeader>

        {/* Filter bar */}
        {(monthKeys.length > 1 || showAgeFilter) && (
          <div className="px-6 py-3 border-b border-gray-200 shrink-0 flex flex-col gap-2">
            {monthKeys.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] min-w-[60px]">
                  Month
                </span>
                <button
                  onClick={() => setSelectedMonth('any')}
                  className={pillClass(selectedMonth === 'any')}
                >
                  Any
                </button>
                {monthKeys.map(month => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={pillClass(selectedMonth === month)}
                  >
                    {abbreviateMonth(month)}
                  </button>
                ))}
              </div>
            )}
            {showAgeFilter && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] min-w-[60px]">
                  Age group
                </span>
                <button
                  onClick={() => setSelectedAgeId('any')}
                  className={pillClass(selectedAgeId === 'any')}
                >
                  Any age
                </button>
                {ageGroupOptions.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedAgeId(g.id!)}
                    className={pillClass(selectedAgeId === g.id)}
                  >
                    {g.min}–{g.max} yo
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Session list */}
        <ModalBody className="px-6 py-4 flex flex-col gap-2.5">
          {filteredSessions.map((session, index) => (
            <SessionRadioCard
              key={session.id}
              session={session}
              weekNumber={session.sortOrder || index + 1}
              currency={currency}
              campAgeGroups={campAgeGroups}
              campAgeLabel={campAgeLabel}
              campType={campType}
              selected={selectedId === session.id}
              onSelect={setSelectedId}
            />
          ))}
          {filteredSessions.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              No sessions match your filter.
            </div>
          )}
        </ModalBody>

        {/* Footer */}
        <ModalFooter className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          {selectedSession ? (
            (() => {
              const s = new Date(selectedSession.startDate)
              const e = new Date(selectedSession.endDate)
              const diffDays = Math.round((e.getTime() - s.getTime()) / 86400000)
              const unit =
                campType === 'residential'
                  ? diffDays === 1
                    ? 'night'
                    : 'nights'
                  : diffDays === 1
                    ? 'day'
                    : 'days'
              const dateLabel = fmtDateRange(s, e)
              const selPrice =
                selectedSession.pricingType === 'single' && selectedSession.price !== undefined
                  ? selectedSession.price
                  : selectedSession.pricingType === 'age_group' &&
                      selectedSession.ageGroupPrices?.length
                    ? Math.min(...selectedSession.ageGroupPrices.map((a: any) => a.price))
                    : null
              return (
                <>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {dateLabel} · {diffDays} {unit}
                    </p>
                    {selPrice !== null && (
                      <p className="text-base font-extrabold text-gray-900 leading-tight">
                        {formatCurrency(selPrice, currency)}
                      </p>
                    )}
                  </div>
                  <a
                    href={`/camps/${campSlug}/book?sessionId=${selectedSession.id}`}
                    onClick={handleReserve}
                    className="shrink-0 bg-primary hover:brightness-95 text-secondary text-[15px] font-bold rounded-xl py-3 px-6 transition-all whitespace-nowrap"
                  >
                    Reserve →
                  </a>
                </>
              )
            })()
          ) : (
            <>
              <span className="text-sm font-medium text-gray-400">
                Select a session to continue
              </span>
              <span className="shrink-0 bg-gray-200 text-gray-400 text-[15px] font-bold rounded-xl py-3 px-6 cursor-not-allowed whitespace-nowrap">
                Reserve →
              </span>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ─── Radio card ───────────────────────────────────────────────────────────────

function SessionRadioCard({
  session,
  weekNumber: _weekNumber,
  currency,
  campAgeGroups,
  campAgeLabel,
  campType,
  selected,
  onSelect,
}: {
  session: Session
  weekNumber: number
  currency: string
  campAgeGroups: AgeGroup[]
  campAgeLabel: string | null
  campType: CampType
  selected: boolean
  onSelect: (id: string) => void
}) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const unit = campType === 'residential' ? 'night' : 'day'
  const durationLabel = `${diffDays} ${unit}${diffDays !== 1 ? 's' : ''}`

  const spotsLeft =
    session.totalSpots != null && session.bookedCount != null
      ? session.totalSpots - session.bookedCount
      : (session.totalSpots ?? null)

  const isSoldOut = spotsLeft !== null && spotsLeft <= 0
  const isAlmostFull = !isSoldOut && spotsLeft !== null && spotsLeft <= 5
  const isAmple = !isSoldOut && spotsLeft !== null && spotsLeft > 5

  const getPrice = () => {
    if (session.pricingType === 'single' && session.price !== undefined) return session.price
    if (session.pricingType === 'age_group' && session.ageGroupPrices?.length)
      return Math.min(...session.ageGroupPrices.map(a => a.price))
    return 0
  }

  const price = getPrice()
  const isFromPrice =
    session.pricingType === 'age_group' && (session.ageGroupPrices?.length ?? 0) > 1
  const ageLabel = getSessionAgeLabel(session, campAgeGroups, campAgeLabel)
  const dateRange = fmtDateRange(startDate, endDate)

  return (
    <div
      onClick={() => !isSoldOut && onSelect(session.id)}
      className={`border-[1.5px] rounded-2xl p-4 bg-white transition-all flex items-start gap-3.5 ${
        isSoldOut
          ? 'opacity-50 cursor-not-allowed border-gray-200'
          : selected
            ? 'border-gray-900 bg-gray-50 shadow-sm cursor-pointer'
            : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm cursor-pointer'
      }`}
    >
      {/* Radio */}
      <div
        className={`w-[22px] h-[22px] rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5 transition-all ${
          selected ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-gray-900">{session.name || dateRange}</p>
        <p className="text-sm text-gray-500 mt-0.5 mb-2">
          {session.name ? `${dateRange} · ${durationLabel}` : durationLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ageLabel && (
            <span className="text-xs font-semibold border-[1.5px] border-gray-200 rounded-full px-2.5 py-0.5 text-gray-600 bg-white">
              {ageLabel}
            </span>
          )}
          {isAmple && (
            <span className="text-xs font-semibold border-[1.5px] border-green-200 rounded-full px-2.5 py-0.5 text-green-800 bg-green-50">
              {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </span>
          )}
          {isAlmostFull && (
            <span className="text-xs font-semibold border-[1.5px] border-red-300 rounded-full px-2.5 py-0.5 text-red-700 bg-red-50">
              {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </span>
          )}
          {isSoldOut && (
            <span className="text-xs font-semibold border-[1.5px] border-red-300 rounded-full px-2.5 py-0.5 text-red-700 bg-red-50">
              Fully booked
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right flex flex-col items-end">
        {isFromPrice && <p className="text-[11px] text-gray-400 mb-0.5">from</p>}
        <p
          className={`text-[19px] font-extrabold leading-[1.1] tracking-tight whitespace-nowrap ${
            isSoldOut ? 'line-through text-gray-300' : 'text-gray-900'
          }`}
        >
          {formatCurrency(price, currency)}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{durationLabel}</p>
      </div>
    </div>
  )
}
