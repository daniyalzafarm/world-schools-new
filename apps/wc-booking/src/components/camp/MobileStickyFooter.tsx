'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isSessionBookable } from '@world-schools/wc-utils'
import { formatCurrency } from '../../utils/currency'
import type { Session } from '../../types/sessions'
import type { Camp } from '../../types/camps'

interface MobileStickyFooterProps {
  sessions: Session[]
  currency: string
  campSlug: string
  campType: Camp['type']
  selectedSession: Session | null
  onOpenSessionsModal: () => void
  isAnyModalOpen: boolean
}

function getSessionPrice(session: Session): number | null {
  if (session.pricingType === 'single' && session.price !== undefined) return session.price
  if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
    return Math.min(...session.ageGroupPrices.map(a => a.price))
  }
  return null
}

function getSessionDurationLabel(session: Session, campType: Camp['type']): string {
  const start = new Date(session.startDate)
  const end = new Date(session.endDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const unit = campType === 'residential' ? 'night' : 'day'
  return `${diffDays} ${unit}${diffDays !== 1 ? 's' : ''}`
}

export function MobileStickyFooter({
  sessions,
  currency,
  campSlug,
  campType,
  selectedSession,
  onOpenSessionsModal,
  isAnyModalOpen,
}: MobileStickyFooterProps) {
  // Use MutationObserver to hide footer when any modal is open (body overflow: hidden)
  const [bodyLocked, setBodyLocked] = useState(false)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setBodyLocked(document.body.style.overflow === 'hidden')
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  const activeSessions = sessions.filter(s => s.status === 'published')
  if (!activeSessions.length) return null

  const isHidden = isAnyModalOpen || bodyLocked

  // Only treat the selection as reservable when it's still bookable (not past/invalid);
  // otherwise fall back to the "see all sessions" CTA rather than a dead Reserve link.
  const hasReservableSelection = selectedSession != null && isSessionBookable(selectedSession)

  const selectedPrice = selectedSession ? getSessionPrice(selectedSession) : null
  const isFromPrice =
    selectedSession?.pricingType === 'age_group' &&
    (selectedSession?.ageGroupPrices?.length ?? 0) > 1

  return (
    <div
      className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-5 py-4 shadow-lg z-40 transition-transform duration-200 ${
        isHidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      {hasReservableSelection && selectedSession ? (
        /* Session selected state */
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              {isFromPrice && <span className="text-xs text-gray-400">from</span>}
              <span className="text-lg font-extrabold text-gray-900 tracking-tight">
                {selectedPrice !== null ? formatCurrency(selectedPrice, currency) : '—'}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {getSessionDurationLabel(selectedSession, campType)}
            </div>
          </div>
          <Link
            href={`/camps/${campSlug}/book?sessionId=${selectedSession.id}`}
            className="shrink-0 px-6 py-3 rounded-xl bg-primary hover:brightness-95 text-secondary text-sm font-bold transition-all"
          >
            Reserve →
          </Link>
        </div>
      ) : (
        /* Default state */
        <button
          onClick={onOpenSessionsModal}
          className="w-full py-3.5 rounded-xl bg-primary hover:brightness-95 text-secondary text-sm font-bold transition-all"
        >
          See all {activeSessions.length} session{activeSessions.length !== 1 ? 's' : ''} →
        </button>
      )}
    </div>
  )
}
