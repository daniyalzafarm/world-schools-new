'use client'

import { useState } from 'react'
import { Modal, ModalBody, ModalContent } from '@heroui/react'
import type { FixedSession } from '@/types/sessions'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { FixedSessionsList } from './FixedSessionsList'
import { FixedSessionForm, type FixedSessionFormData } from './FixedSessionForm'

interface FixedSessionsManagerProps {
  campId: string
}

/**
 * Fixed Sessions Manager Component
 * Main component for managing fixed sessions
 * Handles CRUD operations and state management
 */
export function FixedSessionsManager({ campId }: FixedSessionsManagerProps) {
  // Data hooks
  const { sessions, isLoading, reload } = useSessionsData(campId)
  const {
    createFixedSession,
    updateFixedSession,
    duplicateFixedSession,
    deleteSession,
    toggleSessionStatus,
    isCreatingFixed,
    isUpdatingFixed,
    isDuplicating,
    isDeleting,
    isToggling,
  } = useSessionMutations(campId)

  // UI state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<FixedSession | null>(null)

  // Filter fixed sessions
  const fixedSessions = (sessions?.filter(s => s.type === 'fixed') || []) as FixedSession[]

  // Handle create
  const handleCreate = () => {
    setEditingSession(null)
    setIsFormOpen(true)
  }

  // Handle edit
  const handleEdit = (session: FixedSession) => {
    setEditingSession(session)
    setIsFormOpen(true)
  }

  // Handle form submit
  const handleFormSubmit = async (data: FixedSessionFormData) => {
    try {
      if (editingSession) {
        // Update existing session
        await updateFixedSession(editingSession.id, data, {
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
        await createFixedSession(data, {
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

  // Handle form cancel
  const handleFormCancel = () => {
    setIsFormOpen(false)
    setEditingSession(null)
  }

  return (
    <>
      {/* Sessions List */}
      <FixedSessionsList
        sessions={fixedSessions}
        isLoading={isLoading}
        onCreateSession={handleCreate}
        onEditSession={handleEdit}
        onDeleteSession={handleDelete}
        onDuplicateSession={handleDuplicate}
        onToggleStatus={handleToggleStatus}
      />

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[90vh]',
        }}
      >
        <ModalContent>
          <ModalBody className="p-6">
            <FixedSessionForm
              session={editingSession ?? undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isSubmitting={isCreatingFixed || isUpdatingFixed}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}
