'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import { SectionHeader } from './SectionHeader'
import type { Session } from '@/types/sessions'
import type { SessionType } from '@/types/camps'
import { formatCurrency } from '@/utils/currency'

interface SessionsSectionProps {
  sessions: Session[]
  sessionType: SessionType | null | undefined
  campName: string
  currency?: string
}

export function SessionsSection({
  sessions,
  sessionType,
  campName,
  currency = 'USD',
}: SessionsSectionProps) {
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
        {displayedSessions.map(session => (
          <SessionCard key={session.id} session={session} currency={currency} />
        ))}
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

// Session Card Component
function SessionCard({
  session,
  currency = 'USD',
}: {
  session: Session
  currency?: string
}) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)

  // Calculate duration
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const weeks = Math.floor(durationDays / 7)
  const days = durationDays % 7

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Calculate spots left (if totalSpots is set)
  const spotsLeft = session.totalSpots ?? null

  // Determine badge
  const getBadge = () => {
    if (spotsLeft !== null && spotsLeft <= 5) {
      return { text: 'LAST SPOTS', icon: '🔥', color: 'bg-red-50 text-red-700' }
    }
    // You can add more badge logic here (e.g., NEXT AVAILABLE, MOST POPULAR, etc.)
    return null
  }

  const badge = getBadge()

  // Get price (single pricing or first age group price)
  const getPrice = () => {
    if (session.pricingType === 'single' && session.price !== undefined) {
      return session.price
    } else if (session.pricingType === 'age_group' && session.ageGroupPrices && session.ageGroupPrices.length > 0) {
      // Return the minimum price from age groups
      return Math.min(...session.ageGroupPrices.map(agp => agp.price))
    }
    return 0
  }

  const price = getPrice()

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
            {spotsLeft !== null && (
              <p className="text-gray-700 font-medium mt-2">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Fully booked'}
              </p>
            )}
          </div>
        </div>

        <div className="text-right ml-6">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(price, currency)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {session.pricingType === 'age_group' ? 'from' : 'per child'}
          </div>
        </div>
      </div>
    </div>
  )
}
