'use client'

import { useState } from 'react'
import { Modal, ModalBody, ModalContent } from '@heroui/react'
import type { FlexibleSession } from '@/types/sessions'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { FlexibleSessionsList } from './FlexibleSessionsList'
import { FlexibleSessionForm, type FlexibleSessionFormData } from './FlexibleSessionForm'

interface FlexibleSessionsManagerProps {
  campId: string
}

/**
 * Flexible Sessions Manager Component
 * Main component for managing flexible sessions
 * Handles CRUD operations and state management
 */
export function FlexibleSessionsManager({ campId }: FlexibleSessionsManagerProps) {
  // Data hooks
  const { sessions, isLoading, reload } = useSessionsData(campId)
  const {
    createFlexibleSession,
    updateFlexibleSession,
    deleteSession,
    toggleSessionStatus,
    isCreatingFlexible,
    isUpdatingFlexible,
    isDeleting,
    isToggling,
  } = useSessionMutations(campId)

  // UI state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<FlexibleSession | null>(null)

  // Filter flexible sessions
  const flexibleSessions = (sessions?.filter(s => s.type === 'flexible') || []) as FlexibleSession[]

  // Handle create
  const handleCreate = () => {
    setEditingSession(null)
    setIsFormOpen(true)
  }

  // Handle edit
  const handleEdit = (session: FlexibleSession) => {
    setEditingSession(session)
    setIsFormOpen(true)
  }

  // Handle form submit
  const handleFormSubmit = async (data: FlexibleSessionFormData) => {
    try {
      if (editingSession) {
        // Update existing session
        await updateFlexibleSession(editingSession.id, data, {
          onSuccess: () => {
            setIsFormOpen(false)
            setEditingSession(null)
            reload().catch(error => {
              console.error('Failed to reload sessions:', error)
            })
          },
        })
      } else {
        // Create new session
        await createFlexibleSession(data, {
          onSuccess: () => {
            setIsFormOpen(false)
            reload().catch(error => {
              console.error('Failed to reload sessions:', error)
            })
          },
        })
      }
    } catch (error) {
      console.error('Failed to save session:', error)
    }
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

  // Handle form cancel
  const handleFormCancel = () => {
    setIsFormOpen(false)
    setEditingSession(null)
  }

  return (
    <>
      {/* Sessions List */}
      <FlexibleSessionsList
        sessions={flexibleSessions}
        isLoading={isLoading}
        onCreateSession={handleCreate}
        onEditSession={handleEdit}
        onDeleteSession={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[90vh]',
        }}
      >
        <ModalContent>
          <ModalBody className="p-6">
            <FlexibleSessionForm
              session={editingSession ?? undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isSubmitting={isCreatingFlexible || isUpdatingFlexible}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}
