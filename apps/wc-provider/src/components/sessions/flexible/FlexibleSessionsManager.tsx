'use client'

import { useRouter } from 'next/navigation'
import type { FlexibleSession } from '@/types/sessions'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { FlexibleSessionsList } from './FlexibleSessionsList'

interface FlexibleSessionsManagerProps {
  campId: string
  onChangeSessionType?: () => void
}

/**
 * Flexible Sessions Manager Component
 * Main component for managing flexible sessions
 * Handles CRUD operations and state management
 */
export function FlexibleSessionsManager({
  campId,
  onChangeSessionType,
}: FlexibleSessionsManagerProps) {
  const router = useRouter()

  // Data hooks
  const { sessions, canChangeType, isLoading, reload } = useSessionsData(campId)
  const { deleteSession, toggleSessionStatus } = useSessionMutations(campId)

  // Filter flexible sessions
  const flexibleSessions = (sessions?.filter(s => s.type === 'flexible') || []) as FlexibleSession[]

  // Handle create - navigate to create page
  const handleCreate = () => {
    router.push(`/camps/${campId}/edit/sessions/flexible/create`)
  }

  // Handle edit - navigate to edit page
  const handleEdit = (session: FlexibleSession) => {
    router.push(`/camps/${campId}/edit/sessions/flexible/${session.id}/edit`)
  }

  // Handle delete
  const handleDelete = async (sessionId: string) => {
    const success = await deleteSession(sessionId)
    if (success) {
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
    <FlexibleSessionsList
      sessions={flexibleSessions}
      isLoading={isLoading}
      canChangeType={canChangeType}
      onCreateSession={handleCreate}
      onEditSession={handleEdit}
      onDeleteSession={handleDelete}
      onToggleStatus={handleToggleStatus}
      onChangeSessionType={onChangeSessionType}
    />
  )
}
