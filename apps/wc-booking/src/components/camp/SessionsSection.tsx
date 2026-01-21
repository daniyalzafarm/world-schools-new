'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import { SectionHeader } from './SectionHeader'
import type { FixedSession, FlexibleSession } from '@/types/sessions'
import type { SessionType } from '@/types/camps'

interface SessionsSectionProps {
  sessions: (FlexibleSession | FixedSession)[]
  sessionType: SessionType | null | undefined
  campName: string
}

export function SessionsSection({ sessions, sessionType, campName }: SessionsSectionProps) {
  const [showAll, setShowAll] = useState(false)

  if (!sessions || sessions.length === 0) {
    return null
  }

  // Show first 5 sessions by default
  const displayedSessions = showAll ? sessions : sessions.slice(0, 5)
  const hasMore = sessions.length > 5

  return (
    <div className="mb-12">
      <SectionHeader title="Dates & Pricing" icon="📅" className="mb-6" />

      <div className="space-y-4 mt-6">
        {displayedSessions.map(session => {
          if (session.type === 'fixed') {
            return <FixedSessionCard key={session.id} session={session as FixedSession} />
          } else {
            return <FlexibleSessionCard key={session.id} session={session as FlexibleSession} />
          }
        })}
      </div>

      {hasMore && !showAll && (
        <div className="mt-6 text-center">
          <Button
            onPress={() => setShowAll(true)}
            variant="bordered"
            className="border-gray-900 text-gray-900 font-semibold"
          >
            Check All {sessions.length} Sessions
          </Button>
        </div>
      )}
    </div>
  )
}

// Fixed Session Card Component
function FixedSessionCard({ session }: { session: FixedSession }) {
  const startDate = new Date(session.sessionStartDate)
  const endDate = new Date(session.sessionEndDate)

  // Calculate duration
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const weeks = Math.floor(durationDays / 7)
  const days = durationDays % 7

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Calculate spots left (if capacity is set)
  const spotsLeft = session.capacity ?? null

  // Determine badge
  const getBadge = () => {
    if (spotsLeft !== null && spotsLeft <= 5) {
      return { text: 'LAST SPOTS', icon: '🔥', color: 'bg-red-50 text-red-700' }
    }
    // You can add more badge logic here (e.g., NEXT AVAILABLE, MOST POPULAR, etc.)
    return null
  }

  const badge = getBadge()

  return (
    <div className="border border-gray-300 rounded-xl p-6 hover:shadow-md transition-shadow">
      {badge && (
        <div
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-3 ${badge.color}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.name}</h3>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
            <p>
              {weeks > 0 && `${weeks} week${weeks > 1 ? 's' : ''}`}
              {weeks > 0 && days > 0 && ' • '}
              {days > 0 && `${days} day${days > 1 ? 's' : ''}`}
              {weeks === 0 && days === 0 && '1 day'}
            </p>
            {session.description && <p className="text-gray-500 mt-2">{session.description}</p>}
            {spotsLeft !== null && (
              <p className="text-gray-700 font-medium mt-2">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Fully booked'}
              </p>
            )}
          </div>
        </div>

        <div className="text-right ml-6">
          <div className="text-2xl font-bold text-gray-900">€{session.price.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">per child</div>
        </div>
      </div>
    </div>
  )
}

// Flexible Session Card Component
function FlexibleSessionCard({ session }: { session: FlexibleSession }) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="border border-gray-300 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-3 bg-blue-50 text-blue-700">
        <span>⭐</span>
        <span>FLEXIBLE DATES</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.name}</h3>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Available: {formatDate(startDate)} - {formatDate(endDate)}
            </p>
            {session.description && <p className="text-gray-500 mt-2">{session.description}</p>}
            {session.minDaysLimit && session.maxDaysLimit && (
              <p className="text-gray-700 mt-2">
                Choose {session.minDaysLimit}-{session.maxDaysLimit} days
              </p>
            )}
            {session.capacity && !session.unlimitedCapacity && (
              <p className="text-gray-700 font-medium mt-2">{session.capacity} spots available</p>
            )}
          </div>
        </div>

        <div className="text-right ml-6">
          {session.basePricePerDay && (
            <>
              <div className="text-2xl font-bold text-gray-900">
                €{session.basePricePerDay.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">per day</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
