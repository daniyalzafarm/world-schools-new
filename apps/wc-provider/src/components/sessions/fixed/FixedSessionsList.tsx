'use client'

import { Button, Spinner } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useConfirmDialog } from '@world-schools/ui-web'
import type { FixedSession } from '@/types/sessions'
import { FixedSessionCard } from './FixedSessionCard'
import { FixedSessionsEmptyState } from './FixedSessionsEmptyState'

interface FixedSessionsListProps {
  sessions: FixedSession[]
  isLoading?: boolean
  canChangeType?: boolean
  onCreateSession: () => void
  onEditSession: (session: FixedSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  onDuplicateSession: (sessionId: string) => Promise<void>
  onToggleStatus: (sessionId: string) => Promise<void>
  onChangeSessionType?: () => void
}

/**
 * Fixed Sessions List Component
 * Displays list of fixed sessions with actions
 */
export function FixedSessionsList({
  sessions,
  isLoading = false,
  canChangeType = false,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onDuplicateSession,
  onToggleStatus,
  onChangeSessionType,
}: FixedSessionsListProps) {
  const { confirm } = useConfirmDialog()

  // Handle delete with confirmation
  const handleDelete = async (session: FixedSession) => {
    // Check if session has bookings
    const hasBookings = !!session.bookedCount

    if (hasBookings) {
      // Show error message for sessions with bookings
      await confirm({
        title: 'Cannot Delete Session',
        message: `This session has ${session.bookedCount} active ${session.bookedCount === 1 ? 'booking' : 'bookings'}.\n\nYou cannot delete a session with existing bookings. Please contact support if you need to cancel this session.`,
        confirmText: 'Got It',
        cancelText: '',
        variant: 'danger',
      })
      return
    }

    // Show confirmation dialog for sessions without bookings
    const confirmed = await confirm({
      title: 'Delete Session?',
      message: `Are you sure you want to delete "${session.name}"?\n\nThis action cannot be undone and will permanently remove this session from your camp.`,
      confirmText: 'Delete Session',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      try {
        await onDeleteSession(session.id)
      } catch (error) {
        console.error('Failed to delete session:', error)
      }
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <FixedSessionsEmptyState
        onCreateSession={onCreateSession}
        canChangeType={canChangeType}
        onChangeSessionType={onChangeSessionType}
      />
    )
  }

  // Sessions list
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-bold text-default-900">Fixed Sessions</h2>
          <p className="text-[14px] text-default-600 mt-1">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="w-5 h-5" />}
          onPress={onCreateSession}
          className="font-semibold"
        >
          Create Session
        </Button>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map(session => (
          <FixedSessionCard
            key={session.id}
            session={session}
            onEdit={onEditSession}
            onDelete={handleDelete}
            onDuplicate={() => onDuplicateSession(session.id)}
            onToggleStatus={() => onToggleStatus(session.id)}
          />
        ))}
      </div>
    </div>
  )
}
