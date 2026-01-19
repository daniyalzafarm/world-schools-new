'use client'

import { useRouter } from 'next/navigation'
import type { FixedSession } from '@/types/sessions'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { FixedSessionsList } from './FixedSessionsList'

interface FixedSessionsManagerProps {
  campId: string
  onChangeSessionType?: () => void
}

/**
 * Fixed Sessions Manager Component
 * Main component for managing fixed sessions
 * Handles CRUD operations and state management
 */
export function FixedSessionsManager({ campId, onChangeSessionType }: FixedSessionsManagerProps) {
  const router = useRouter()

  // Data hooks
  const { sessions, canChangeType, isLoading, reload } = useSessionsData(campId)
  const { duplicateFixedSession, deleteSession, toggleSessionStatus } = useSessionMutations(campId)

  // Filter fixed sessions
  const fixedSessions = (sessions?.filter(s => s.type === 'fixed') || []) as FixedSession[]

  // Handle create - navigate to create page
  const handleCreate = () => {
    router.push(`/camps/${campId}/edit/sessions/fixed/create`)
  }

  // Handle edit - navigate to edit page
  const handleEdit = (session: FixedSession) => {
    router.push(`/camps/${campId}/edit/sessions/fixed/${session.id}/edit`)
  }

  // Handle delete
  const handleDelete = async (sessionId: string) => {
    const success = await deleteSession(sessionId)
    if (success) {
      await reload()
    }
  }

  // Handle duplicate
  const handleDuplicate = async (sessionId: string) => {
    const newSession = await duplicateFixedSession(sessionId)
    if (newSession) {
      await reload()
    }
  }

  // Handle toggle status
  const handleToggleStatus = async (sessionId: string) => {
    const updatedSession = await toggleSessionStatus(sessionId)
    if (updatedSession) {
      await reload()
    }
  }

  return (
    <FixedSessionsList
      sessions={fixedSessions}
      isLoading={isLoading}
      canChangeType={canChangeType}
      onCreateSession={handleCreate}
      onEditSession={handleEdit}
      onDeleteSession={handleDelete}
      onDuplicateSession={handleDuplicate}
      onToggleStatus={handleToggleStatus}
      onChangeSessionType={onChangeSessionType}
    />
  )
}
