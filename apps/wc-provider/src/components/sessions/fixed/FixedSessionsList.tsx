'use client'

import { useState } from 'react'
import { Button, Spinner } from '@heroui/react'
import { Plus } from 'lucide-react'
import type { FixedSession } from '@/types/sessions'
import { FixedSessionCard } from './FixedSessionCard'
import { FixedSessionsEmptyState } from './FixedSessionsEmptyState'
import { DeleteSessionDialog } from '../shared/DeleteSessionDialog'

interface FixedSessionsListProps {
  sessions: FixedSession[]
  isLoading?: boolean
  onCreateSession: () => void
  onEditSession: (session: FixedSession) => void
  onDeleteSession: (sessionId: string) => void
  onDuplicateSession: (sessionId: string) => void
  onToggleStatus: (sessionId: string) => void
}

/**
 * Fixed Sessions List Component
 * Displays list of fixed sessions with actions
 */
export function FixedSessionsList({
  sessions,
  isLoading = false,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onDuplicateSession,
  onToggleStatus,
}: FixedSessionsListProps) {
  const [sessionToDelete, setSessionToDelete] = useState<FixedSession | null>(null)
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
    return <FixedSessionsEmptyState onCreateSession={onCreateSession} />
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

      {/* Sessions Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map(session => (
          <FixedSessionCard
            key={session.id}
            session={session}
            onEdit={onEditSession}
            onDelete={setSessionToDelete}
            onDuplicate={() => onDuplicateSession(session.id)}
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
          bookingCount={sessionToDelete.bookedCount}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
