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
    await deleteSession(sessionId, {
      onSuccess: () => {
        reload().catch(error => {
          console.error('Failed to reload sessions:', error)
        })
      },
    })
  }

  // Handle duplicate
  const handleDuplicate = async (sessionId: string) => {
    await duplicateFixedSession(sessionId, {
      onSuccess: () => {
        reload().catch(error => {
          console.error('Failed to reload sessions:', error)
        })
      },
    })
  }

  // Handle toggle status
  const handleToggleStatus = async (sessionId: string) => {
    await toggleSessionStatus(sessionId, {
      onSuccess: () => {
        reload().catch(error => {
          console.error('Failed to reload sessions:', error)
        })
      },
    })
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
