'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import { SessionForm, type SessionFormData } from '@/components/sessions/SessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useCampsStore } from '@/stores/camps-store'
import type { CampType } from '@/types/camps'

/**
 * Create Session Page
 * Standalone page for creating a new session
 */
export default function CreateSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const submitRef = useRef<(() => void) | undefined>(undefined)

  const { createSession, isCreating } = useSessionMutations(campId)
  const { currentCamp, fetchCamp } = useCampsStore()
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

  // Handle form submit
  const handleSubmit = async (data: SessionFormData) => {
    await createSession(data, {
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

  return (
    <>
      {/* Add padding-bottom to prevent content from being hidden behind fixed footer */}
      <div className="pb-20">
        <SessionBreadcrumb
          title="Create Session"
          subtitle="Set up a session with specific start and end dates."
        />

        <SessionForm
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
        isSubmitting={isCreating}
        mode="create"
      />
    </>
  )
}
