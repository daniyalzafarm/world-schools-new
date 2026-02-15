'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import { SessionForm, type SessionFormData } from '@/components/sessions/SessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useCampsStore } from '@/stores/camps-store'
import type { Session } from '@/types/sessions'
import type { CampType } from '@/types/camps'

/**
 * Edit Session Page
 * Standalone page for editing an existing session
 */
export default function EditSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const sessionId = params.sessionId as string
  const submitRef = useRef<(() => void) | undefined>(undefined)

  const { sessions, isLoading } = useSessionsData(campId)
  const { updateSession, isUpdating } = useSessionMutations(campId)
  const { fetchCamp, currentCamp } = useCampsStore()

  const [session, setSession] = useState<Session | null>(null)
  const [campType, setCampType] = useState<CampType | null>(null)

  // Fetch camp data to get camp type
  useEffect(() => {
    if (campId) {
      fetchCamp(campId)
        .then(() => {
          const camp = useCampsStore.getState().currentCamp
          if (camp) {
            setCampType(camp.type)
          }
        })
        .catch(error => {
          console.error('Failed to fetch camp:', error)
        })
    }
  }, [campId, fetchCamp])

  // Find the session to edit
  useEffect(() => {
    if (!isLoading && sessions) {
      const foundSession = sessions.find(s => s.id === sessionId)
      if (foundSession) {
        setSession(foundSession)
      }
    }
  }, [isLoading, sessions, sessionId])

  // Handle form submit
  const handleSubmit = async (data: SessionFormData) => {
    await updateSession(sessionId, data, {
      onSuccess: () => {
        router.push(`/camps/${campId}/edit/sessions`)
      },
    })
  }

  // Handle cancel
  const handleCancel = () => {
    router.push(`/camps/${campId}/edit/sessions`)
  }

  // Handle footer submit
  const handleFooterSubmit = () => {
    if (submitRef.current) {
      submitRef.current()
    }
  }

  // Hide the main CampEditorFooter when this component mounts
  useEffect(() => {
    // Add a class to the body to indicate we're on a session form page
    document.body.classList.add('session-form-page')

    // Cleanup: remove the class when component unmounts
    return () => {
      document.body.classList.remove('session-form-page')
    }
  }, [])

  // Loading state
  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Add padding-bottom to prevent content from being hidden behind fixed footer */}
      <div className="pb-20">
        <SessionBreadcrumb
          title={`Edit Session: ${session.name}`}
          subtitle="Update the session details."
        />

        <SessionForm
          session={session}
          onSubmit={handleSubmit}
          onSubmitRef={submitRef}
          campType={campType}
          camp={currentCamp}
        />
      </div>

      <SessionFormFooter
        campId={campId}
        onCancel={handleCancel}
        onSubmit={handleFooterSubmit}
        isSubmitting={isUpdating}
        mode="edit"
      />
    </>
  )
}
