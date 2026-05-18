'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Spinner,
} from '@heroui/react'
import { MoreVertical, Percent, Plus, Settings } from 'lucide-react'
import type { Session } from '@/types/sessions'
import { SessionsEmptyState } from './SessionsEmptyState'
import { formatDateRange } from '@/utils/sessionFormatters'

type FilterType = 'all' | 'available' | 'almost-full' | 'full' | 'draft'

interface SessionsListProps {
  sessions: Session[]
  isLoading?: boolean
  selectedSession: Session | null
  onSelectSession: (session: Session | null) => void
  onCreateSession: () => void
  onManageDiscounts: () => void
  onManageSettings: () => void
  sortBy?: string
  onSortChange: (sortBy: string | undefined) => void
}

/**
 * Sessions List Component
 * Displays list of sessions with filters
 * Right sidebar is managed by SessionsPage via camp editor layout context
 */
export function SessionsList({
  sessions,
  isLoading = false,
  selectedSession,
  onSelectSession,
  onCreateSession,
  onManageDiscounts,
  onManageSettings,
  sortBy,
  onSortChange,
}: SessionsListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Helper: Calculate spots left for a session
  const calculateSpotsLeft = (session: Session): number => {
    if (session.availabilityType === 'single') {
      return (session.totalSpots ?? 0) - (session.bookedCount ?? 0)
    } else {
      const totalSpots = session.ageGroupSpots?.reduce((sum, ags) => sum + ags.spots, 0) ?? 0
      return totalSpots - (session.bookedCount ?? 0)
    }
  }

  // Helper: Get session status based on capacity
  const getSessionStatus = (session: Session): FilterType => {
    if (session.status === 'draft') return 'draft'
    const spotsLeft = calculateSpotsLeft(session)
    if (spotsLeft === 0) return 'full'
    if (spotsLeft <= 5) return 'almost-full'
    return 'available'
  }

  // Helper: Get capacity dot color
  const getCapacityDotColor = (session: Session): string => {
    const status = getSessionStatus(session)
    switch (status) {
      case 'available':
        return 'bg-success-500'
      case 'almost-full':
        return 'bg-warning-500'
      case 'full':
        return 'bg-danger-500'
      case 'draft':
        return 'bg-default-300'
      default:
        return 'bg-default-300'
    }
  }

  // Filter sessions based on active filter
  const filteredSessions = useMemo(() => {
    if (activeFilter === 'all') return sessions
    return sessions.filter(s => getSessionStatus(s) === activeFilter)
  }, [sessions, activeFilter])

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    return {
      all: sessions.length,
      available: sessions.filter(s => getSessionStatus(s) === 'available').length,
      'almost-full': sessions.filter(s => getSessionStatus(s) === 'almost-full').length,
      full: sessions.filter(s => getSessionStatus(s) === 'full').length,
      draft: sessions.filter(s => getSessionStatus(s) === 'draft').length,
    }
  }, [sessions])

  // Filter labels
  const filterLabels: Record<FilterType, string> = {
    all: 'All',
    available: 'Available',
    'almost-full': 'Almost Full',
    full: 'Full',
    draft: 'Draft',
  }

  // Get sort label for chip display
  const getSortLabel = (value: string) => {
    const labels: Record<string, string> = {
      'date-asc': 'Date (earliest first)',
      'date-desc': 'Date (latest first)',
      duration: 'Duration',
      price: 'Price',
      capacity: 'Capacity',
    }
    return labels[value] || value
  }

  // Handle sort selection
  const handleSortSelect = (value: string) => {
    onSortChange(value)
  }

  // Clear sort
  const handleClearSort = () => {
    onSortChange(undefined)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Sessions list (left column only - right sidebar handled by layout)
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="tmb-1.5 text-2xl font-semibold text-foreground">Sessions</h2>
          <p className="text-base leading-normal text-default-500">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Deposit Settings Button */}
          <Button
            radius="full"
            isIconOnly
            variant="bordered"
            onPress={onManageSettings}
            className="w-10 h-10 border-1"
            aria-label="Deposit settings"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </Button>

          {/* Manage Discounts Button */}
          <Button
            radius="full"
            isIconOnly
            variant="bordered"
            onPress={onManageDiscounts}
            className="w-10 h-10 border-1"
          >
            <Percent className="w-5 h-5 text-gray-500" />
          </Button>

          {/* Sort Dropdown Menu */}
          <Dropdown>
            <DropdownTrigger>
              <Button radius="full" isIconOnly variant="bordered" className="w-10 h-10 border-1">
                <MoreVertical className="w-5 h-5 text-gray-500" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Sort options"
              onAction={key => handleSortSelect(key as string)}
            >
              <DropdownSection title="SORT BY">
                <DropdownItem key="date-asc">Date (earliest first)</DropdownItem>
                <DropdownItem key="date-desc">Date (latest first)</DropdownItem>
                <DropdownItem key="duration">Duration</DropdownItem>
                <DropdownItem key="price">Price</DropdownItem>
                <DropdownItem key="capacity">Capacity</DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>

          <Button
            radius="full"
            isIconOnly
            color="primary"
            onPress={onCreateSession}
            className="w-10 h-10"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <SessionsEmptyState onCreateSession={onCreateSession} />
      ) : (
        <>
          {/* Filter Chips */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {/* Sort Chip (if active) */}
            {sortBy && (
              <Chip
                variant="flat"
                color="secondary"
                onClose={handleClearSort}
                className="cursor-pointer"
              >
                Sort: {getSortLabel(sortBy)}
              </Chip>
            )}

            {/* Filter Chips */}
            {(['all', 'available', 'almost-full', 'full', 'draft'] as FilterType[]).map(filter => (
              <Chip
                key={filter}
                variant={activeFilter === filter ? 'solid' : 'flat'}
                color={activeFilter === filter ? 'secondary' : 'default'}
                onClick={() => setActiveFilter(filter)}
                className="cursor-pointer"
              >
                {filterLabels[filter]} ({filterCounts[filter]})
              </Chip>
            ))}
          </div>
          <div className="space-y-3">
            {filteredSessions.map(session => {
              const spotsLeft = calculateSpotsLeft(session)
              const isSelected = selectedSession?.id === session.id

              return (
                <div
                  key={session.id}
                  className={`border rounded-xl p-5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-default-900 bg-default-50'
                      : 'border-default-200 hover:border-default-400'
                  }`}
                  style={
                    isSelected ? { boxShadow: '0 2px 12px rgba(69, 240, 181, 0.2)' } : undefined
                  }
                  onClick={() => onSelectSession(isSelected ? null : session)}
                >
                  <div className="flex items-center gap-5">
                    {/* Capacity Dot */}
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${getCapacityDotColor(session)}`}
                    />

                    {/* Session Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-default-900 truncate">
                        {session.name}
                      </h3>
                      <p className="text-sm text-default-600">
                        {formatDateRange(session.startDate, session.endDate)}
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-default-900">
                        {session.status === 'draft' ? (
                          <span className="text-default-500">Draft</span>
                        ) : (
                          <span>{spotsLeft} spots left</span>
                        )}
                      </div>
                      {session.status !== 'draft' && (
                        <div className="text-sm text-default-600">
                          {session.bookedCount === 0
                            ? 'No bookings yet'
                            : `${session.bookedCount} booking${session.bookedCount! > 1 ? 's' : ''}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
