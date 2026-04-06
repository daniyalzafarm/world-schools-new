'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContextType } from '@world-schools/wc-frontend-utils'
import { useAuth } from '../../hooks/use-auth'
import { useMessagingStore } from '../../stores/messaging-store'
import { formatCurrency } from '../../utils/currency'
import type { Camp } from '../../types/camps'
import type { Session } from '../../types/sessions'

interface CampSidebarProps {
  camp: Camp
  sessions: Session[]
  currency: string
  selectedSession: Session | null
  onSessionSelect: (session: Session | null) => void
  onOpenSessionsModal: () => void
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

function getSessionDurationLabel(session: Session, campType: Camp['type']): string {
  const start = new Date(session.startDate)
  const end = new Date(session.endDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const unit = campType === 'residential' ? 'night' : 'day'
  return `${diffDays} ${unit}${diffDays !== 1 ? 's' : ''}`
}

function getSessionPrice(session: Session): number | null {
  if (session.pricingType === 'single' && session.price !== undefined) return session.price
  if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
    return Math.min(...session.ageGroupPrices.map(a => a.price))
  }
  return null
}

function getMinPrice(sessions: Session[]): number | null {
  if (!sessions.length) return null
  const prices = sessions.map(getSessionPrice).filter((p): p is number => p !== null)
  return prices.length ? Math.min(...prices) : null
}

function getSessionSpotsLeft(session: Session): number | null {
  if (session.totalSpots != null && session.bookedCount != null)
    return session.totalSpots - session.bookedCount
  return session.totalSpots ?? null
}

// ─── Compact session card (sidebar only) ─────────────────────────────────────

interface CompactSessionCardProps {
  session: Session
  campType: Camp['type']
  currency: string
  campAgeLabel: string | null
  isSelected: boolean
  onSelect: (session: Session) => void
}

function CompactSessionCard({
  session,
  campType,
  currency,
  campAgeLabel,
  isSelected,
  onSelect,
}: CompactSessionCardProps) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)
  const spotsLeft = getSessionSpotsLeft(session)
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0
  const price = getSessionPrice(session)
  const durationLabel = getSessionDurationLabel(session, campType)
  const metaText = isSoldOut
    ? `Sold out · ${durationLabel}`
    : `${campAgeLabel ? `${campAgeLabel} · ` : ''}${durationLabel}`
  const dateLabel = session.name || fmtDateRange(startDate, endDate)

  if (isSoldOut) {
    return (
      <div className="border-[1.5px] border-gray-200 rounded-[14px] px-4 py-3.5 mb-2 flex items-center gap-3 bg-white opacity-40 cursor-not-allowed pointer-events-none">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-gray-400 leading-tight mb-0.5 line-through">
            {dateLabel}
          </div>
          <div className="text-[13px] text-gray-400 leading-snug">{metaText}</div>
        </div>
        {price !== null && (
          <div className="text-[20px] font-extrabold shrink-0 text-gray-400 line-through">
            {formatCurrency(price, currency)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelect(session)}
      className={[
        'border-[1.5px] rounded-[14px] px-4 py-3.5 mb-2 flex items-center gap-3 cursor-pointer transition-all',
        isSelected
          ? 'border-gray-900 bg-gray-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-gray-900 leading-tight mb-0.5">{dateLabel}</div>
        <div className="text-[13px] text-gray-400 leading-snug">{metaText}</div>
      </div>
      {price !== null && (
        <div
          className={`text-[20px] font-extrabold shrink-0 ${isSelected ? 'text-secondary' : 'text-gray-900'}`}
        >
          {formatCurrency(price, currency)}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function CampSidebar({
  camp,
  sessions,
  currency,
  selectedSession,
  onSessionSelect,
  onOpenSessionsModal,
}: CampSidebarProps) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { setDraftConversation } = useMessagingStore()
  const [selectedMonth, setSelectedMonth] = useState<string>('any')

  const activeSessions = sessions.filter(s => s.status === 'published')

  // Month filter
  const monthKeys = Array.from(
    new Set(
      activeSessions.map(s =>
        new Date(s.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      )
    )
  )
  const filteredSessions =
    selectedMonth === 'any'
      ? activeSessions
      : activeSessions.filter(
          s =>
            new Date(s.startDate).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            }) === selectedMonth
        )
  const previewSessions = filteredSessions.slice(0, 3)

  const minPrice = getMinPrice(activeSessions)

  const selectedPrice = selectedSession ? getSessionPrice(selectedSession) : null
  const selectedDuration = selectedSession
    ? getSessionDurationLabel(selectedSession, camp.type)
    : null
  const isSelectedSoldOut = selectedSession
    ? (() => {
        const spotsLeft = getSessionSpotsLeft(selectedSession)
        return spotsLeft !== null && spotsLeft <= 0
      })()
    : false

  const showExceptional = (camp.provider?.trustScore ?? 0) >= 90

  const campAgeLabel =
    camp.ageGroups && camp.ageGroups.length > 0
      ? `Ages ${Math.min(...camp.ageGroups.map((g: any) => g.min))}–${Math.max(...camp.ageGroups.map((g: any) => g.max))}`
      : null

  const handleMessageOrganizer = () => {
    if (!isAuthenticated || !user) {
      router.push(`/login?returnUrl=${encodeURIComponent(`/camps/${camp.slug}`)}`)
      return
    }
    if (!camp.provider?.id) return

    setDraftConversation({
      providerId: camp.provider.id,
      providerName: camp.provider.legalCompanyName || 'Provider',
      participantType: 'provider',
      contextType: ContextType.CAMP,
      contextId: camp.id,
      contextName: camp.name,
    })
    router.push('/messages')
  }

  return (
    <div className="hidden lg:block">
      <div className="sticky top-24 border border-gray-200 rounded-2xl p-6 shadow-lg bg-white">
        {/* ── Price area ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            {selectedSession ? (
              <>
                <div className="text-xs text-gray-400 mb-0.5">Selected session</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-gray-900">
                    {selectedPrice !== null ? formatCurrency(selectedPrice, currency) : '—'}
                  </span>
                  {selectedDuration && (
                    <span className="text-sm font-normal text-gray-500">/ {selectedDuration}</span>
                  )}
                </div>
              </>
            ) : minPrice !== null ? (
              <>
                <div className="text-xs text-gray-400 mb-0.5">Starting from</div>
                <div className="text-3xl font-extrabold text-gray-900">
                  {formatCurrency(minPrice, currency)}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-400 mb-0.5">From</div>
                <div className="text-3xl font-extrabold text-gray-400">—</div>
              </>
            )}
          </div>
          {showExceptional && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/15 text-emerald-700 border border-primary/30 whitespace-nowrap shrink-0">
              Exceptional
            </span>
          )}
        </div>

        {/* ── No sessions state ─────────────────────────────────────── */}
        {activeSessions.length === 0 ? (
          <>
            <div className="py-5 text-center text-sm text-gray-400">
              <strong className="block text-base text-gray-600 mb-1">No sessions available</strong>
              Check back later or message the camp directly.
            </div>
            <button
              onClick={handleMessageOrganizer}
              className="cursor-pointer block w-full py-3.5 px-5 bg-white text-gray-700 text-[14px] font-bold border-[1.5px] border-gray-200 rounded-xl text-center hover:border-gray-400 hover:bg-gray-50 transition-colors mt-2"
            >
              Message the camp
            </button>
          </>
        ) : (
          <>
            {/* ── Month filter pills ──────────────────────────────── */}
            {monthKeys.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3.5">
                <button
                  onClick={() => setSelectedMonth('any')}
                  className={`cursor-pointer text-xs font-semibold border-[1.5px] rounded-full px-3 py-1 transition-all ${
                    selectedMonth === 'any'
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  Any
                </button>
                {monthKeys.map(month => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(selectedMonth === month ? 'any' : month)}
                    className={`cursor-pointer text-xs font-semibold border-[1.5px] rounded-full px-3 py-1 transition-all ${
                      selectedMonth === month
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {month.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}

            {/* ── Sessions label ──────────────────────────────────── */}
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.5px] mb-2">
              Available sessions
            </div>

            {/* ── Session cards ───────────────────────────────────── */}
            <div>
              {previewSessions.map(session => (
                <CompactSessionCard
                  key={session.id}
                  session={session}
                  campType={camp.type}
                  currency={currency}
                  campAgeLabel={campAgeLabel}
                  isSelected={selectedSession?.id === session.id}
                  onSelect={s => onSessionSelect(selectedSession?.id === s.id ? null : s)}
                />
              ))}
              {previewSessions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3">No sessions in this month.</p>
              )}
            </div>

            {/* ── CTA ─────────────────────────────────────────────── */}
            {isSelectedSoldOut ? (
              <button
                disabled
                className="cursor-not-allowed pointer-events-none block w-full py-4 px-5 bg-gray-200 text-gray-400 text-base font-bold rounded-xl text-center mt-3"
              >
                Sold out
              </button>
            ) : selectedSession ? (
              <>
                <a
                  href={`/camps/${camp.slug}/book?sessionId=${selectedSession.id}`}
                  className="block w-full py-4 px-5 bg-primary hover:brightness-95 text-secondary text-base font-bold rounded-xl text-center transition-colors mt-3"
                >
                  Reserve
                </a>
                <p className="text-xs text-gray-400 text-center mt-2">
                  You won&apos;t be charged yet
                </p>
              </>
            ) : (
              <button
                onClick={onOpenSessionsModal}
                className="cursor-pointer block w-full py-4 px-5 bg-primary hover:brightness-95 text-secondary text-base font-bold rounded-xl text-center transition-colors mt-3"
              >
                See all {activeSessions.length} sessions →
              </button>
            )}

            {/* ── Message button ───────────────────────────────────── */}
            <button
              onClick={handleMessageOrganizer}
              className="cursor-pointer block w-full py-3.5 px-5 bg-white text-gray-700 text-[14px] font-bold border-[1.5px] border-gray-200 rounded-xl text-center hover:border-gray-400 hover:bg-gray-50 transition-colors mt-2"
            >
              Message the camp
            </button>
          </>
        )}
      </div>
    </div>
  )
}
