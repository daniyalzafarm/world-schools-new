'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionsList } from './SessionsList'
import { SessionDetailPanel } from './SessionDetailPanel'
import { ManageDiscountsPanel } from './ManageDiscountsPanel'
import { CampDepositSettingsPanel } from './CampDepositSettingsPanel'
import { useCampsStore } from '@/stores/camps-store'
import { useSessionsStore } from '@/stores/sessions-store'
import { useCampEditorLayoutOptional } from '@/components/camps/CampEditorLayoutContext'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { getGlobalDiscounts } from '@/services/discounts.service'
import type { Session } from '@/types/sessions'
import type { GlobalDiscount } from '@/types/discounts'

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
  const [showManageDiscounts, setShowManageDiscounts] = useState(false)
  const [showManageSettings, setShowManageSettings] = useState(false)
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const [globalDiscounts, setGlobalDiscounts] = useState<GlobalDiscount[]>([])
  const currentCamp = useCampsStore(state => state.currentCamp)
  const layoutContext = useCampEditorLayoutOptional()
  const setRightSidebar = layoutContext?.setRightSidebar

  // Data from Zustand store - single source of truth
  const sessions = useSessionsStore(state => state.sessions)
  const isLoading = useSessionsStore(state => state.isLoading)
  const loadSessions = useSessionsStore(state => state.loadSessions)
  const reload = useSessionsStore(state => state.reload)

  const { duplicateSession, deleteSession, toggleSessionStatus, updateSessionSpots } =
    useSessionMutations(campId)

  // Load sessions when campId or sortBy changes
  useEffect(() => {
    void loadSessions(campId, sortBy)
  }, [campId, sortBy, loadSessions])

  // Load global discounts when campId changes
  useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const discounts = await getGlobalDiscounts(campId)
        setGlobalDiscounts(discounts)
      } catch (error) {
        console.error('Failed to load global discounts:', error)
      }
    }
    void loadDiscounts()
  }, [campId])

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

  // Handler for opening manage discounts panel
  const handleManageDiscounts = () => {
    setSelectedSession(null) // Close session detail if open
    setShowManageSettings(false) // Close settings panel if open
    setShowManageDiscounts(!showManageDiscounts)
  }

  // Handler for closing manage discounts panel
  const handleCloseManageDiscounts = () => {
    setShowManageDiscounts(false)
  }

  // Handler for opening deposit settings panel
  const handleManageSettings = () => {
    setSelectedSession(null)
    setShowManageDiscounts(false)
    setShowManageSettings(prev => !prev)
  }

  // Reload discounts after changes in ManageDiscountsPanel
  const handleDiscountsUpdate = async () => {
    try {
      const discounts = await getGlobalDiscounts(campId)
      setGlobalDiscounts(discounts)
    } catch (error) {
      console.error('Failed to reload global discounts:', error)
    }
  }

  // Sync right sidebar with selected session or manage discounts panel (only if layout context is available)
  useEffect(() => {
    // Skip sidebar management if not in camp editor context (e.g., in wizard)
    if (!setRightSidebar || !currentCamp) return

    if (showManageSettings) {
      setRightSidebar(
        <CampDepositSettingsPanel campId={campId} onClose={() => setShowManageSettings(false)} />
      )
    } else if (showManageDiscounts) {
      setRightSidebar(
        <ManageDiscountsPanel
          campId={campId}
          onClose={() => {
            handleCloseManageDiscounts()
            void handleDiscountsUpdate()
          }}
        />
      )
    } else if (selectedSession) {
      setRightSidebar(
        <SessionDetailPanel
          session={selectedSession}
          camp={currentCamp}
          ageGroups={currentCamp?.ageGroups}
          globalDiscounts={globalDiscounts}
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
  }, [
    selectedSession,
    showManageDiscounts,
    showManageSettings,
    currentCamp,
    globalDiscounts,
    setRightSidebar,
    reload,
    campId,
  ])

  return (
    <SessionsList
      sessions={sessions}
      isLoading={isLoading}
      selectedSession={selectedSession}
      onSelectSession={setSelectedSession}
      onCreateSession={handleCreate}
      onManageDiscounts={handleManageDiscounts}
      onManageSettings={handleManageSettings}
      sortBy={sortBy}
      onSortChange={setSortBy}
    />
  )
}
