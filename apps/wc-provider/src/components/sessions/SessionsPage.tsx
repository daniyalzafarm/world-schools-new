'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionsList } from './SessionsList'
import { SessionDetailPanel } from './SessionDetailPanel'
import { useCampsStore } from '@/stores/camps-store'
import { useCampEditorLayoutOptional } from '@/components/camps/CampEditorLayoutContext'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useSessionsData } from '@/hooks/useSessionsData'
import type { Session } from '@/types/sessions'

interface SessionsPageProps {
  campId: string
}

/**
 * Sessions Page Component
 * Main entry point for session management
 * Manages session selection state and communicates with camp editor layout for right sidebar
 * Works in both camp editor (with sidebar) and camp wizard (without sidebar) contexts
 */
export function SessionsPage({ campId }: SessionsPageProps) {
  const router = useRouter()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const currentCamp = useCampsStore(state => state.currentCamp)
  const layoutContext = useCampEditorLayoutOptional()
  const setRightSidebar = layoutContext?.setRightSidebar

  // Data hooks - single source of truth
  const { sessions, isLoading, reload } = useSessionsData(campId, sortBy)
  const { duplicateSession, deleteSession, toggleSessionStatus, updateSessionSpots } =
    useSessionMutations(campId)

  // Navigation handlers
  const handleCreate = () => {
    router.push(`/camps/${campId}/edit/sessions/create`)
  }

  const handleEdit = (session: Session) => {
    router.push(`/camps/${campId}/edit/sessions/${session.id}/edit`)
  }

  // Mutation handlers
  const handleDelete = async (session: Session) => {
    const success = await deleteSession(session.id)
    if (success) {
      setSelectedSession(null)
      await reload()
    }
  }

  const handleDuplicate = async (session: Session) => {
    const newSession = await duplicateSession(session.id)
    if (newSession) {
      await reload()
    }
  }

  const handlePublish = async (session: Session) => {
    const updatedSession = await toggleSessionStatus(session.id)
    if (updatedSession) {
      setSelectedSession(updatedSession)
      await reload()
    }
  }

  const handleUpdateSpots = async (sessionId: string, spots: number | Record<string, number>) => {
    const updatedSession = await updateSessionSpots(sessionId, spots)
    if (updatedSession) {
      setSelectedSession(updatedSession)
      await reload()
    }
  }

  // Sync right sidebar with selected session (only if layout context is available)
  useEffect(() => {
    // Skip sidebar management if not in camp editor context (e.g., in wizard)
    if (!setRightSidebar) return

    if (selectedSession) {
      setRightSidebar(
        <SessionDetailPanel
          session={selectedSession}
          ageGroups={currentCamp?.ageGroups}
          onClose={() => setSelectedSession(null)}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onPublish={handlePublish}
          onUpdateSpots={handleUpdateSpots}
        />
      )
    } else {
      setRightSidebar(null)
    }

    return () => setRightSidebar(null)
  }, [selectedSession, currentCamp?.ageGroups, setRightSidebar])

  return (
    <SessionsList
      sessions={sessions}
      isLoading={isLoading}
      selectedSession={selectedSession}
      onSelectSession={setSelectedSession}
      onCreateSession={handleCreate}
      sortBy={sortBy}
      onSortChange={setSortBy}
    />
  )
}
