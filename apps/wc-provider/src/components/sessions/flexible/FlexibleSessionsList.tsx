'use client'

import { Button, Spinner } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useConfirmDialog } from '@world-schools/ui-web'
import type { FlexibleSession } from '@/types/sessions'
import { FlexibleSessionCard } from './FlexibleSessionCard'
import { FlexibleSessionsEmptyState } from './FlexibleSessionsEmptyState'

interface FlexibleSessionsListProps {
  sessions: FlexibleSession[]
  isLoading?: boolean
  canChangeType?: boolean
  onCreateSession: () => void
  onEditSession: (session: FlexibleSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  onToggleStatus: (sessionId: string) => Promise<void>
  onChangeSessionType?: () => void
}

/**
 * Flexible Sessions List Component
 * Displays list of flexible sessions with actions
 * Reference: Design flex-session-3.1.png
 */
export function FlexibleSessionsList({
  sessions,
  isLoading = false,
  canChangeType = false,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onToggleStatus,
  onChangeSessionType,
}: FlexibleSessionsListProps) {
  const { confirm } = useConfirmDialog()

  // Handle delete with confirmation
  const handleDelete = async (session: FlexibleSession) => {
    // Note: Flexible sessions don't have a bookedCount property in the current implementation
    // If bookings are tracked in the future, add the same check as FixedSessionsList

    // Show confirmation dialog
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
      <FlexibleSessionsEmptyState
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
          <h2 className="text-[24px] font-bold text-default-900">Flexible Sessions</h2>
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
          <FlexibleSessionCard
            key={session.id}
            session={session}
            onEdit={onEditSession}
            onDelete={handleDelete}
            onToggleStatus={() => onToggleStatus(session.id)}
          />
        ))}
      </div>
    </div>
  )
}
