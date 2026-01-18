'use client'

import { useState } from 'react'
import { Button, Spinner } from '@heroui/react'
import { Plus } from 'lucide-react'
import type { FlexibleSession } from '@/types/sessions'
import { FlexibleSessionCard } from './FlexibleSessionCard'
import { FlexibleSessionsEmptyState } from './FlexibleSessionsEmptyState'
import { DeleteSessionDialog } from '../shared/DeleteSessionDialog'

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
  const [sessionToDelete, setSessionToDelete] = useState<FlexibleSession | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return

    setIsDeleting(true)
    try {
      await onDeleteSession(sessionToDelete.id)
      setSessionToDelete(null)
    } catch (error) {
      console.error('Failed to delete session:', error)
    } finally {
      setIsDeleting(false)
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
            onDelete={setSessionToDelete}
            onToggleStatus={() => onToggleStatus(session.id)}
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <DeleteSessionDialog
          isOpen={!!sessionToDelete}
          onClose={() => setSessionToDelete(null)}
          onConfirm={handleDeleteConfirm}
          sessionName={sessionToDelete.name}
          bookingCount={0}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
