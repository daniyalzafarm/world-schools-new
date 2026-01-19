'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FixedSessionForm,
  type FixedSessionFormData,
} from '@/components/sessions/fixed/FixedSessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionMutations } from '@/hooks/useSessionMutations'

/**
 * Create Fixed Session Page
 * Standalone page for creating a new fixed session
 */
export default function CreateFixedSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const submitRef = useRef<(() => void) | undefined>(undefined)

  const { createFixedSession, isCreatingFixed } = useSessionMutations(campId)

  // Handle form submit
  const handleSubmit = async (data: FixedSessionFormData) => {
    await createFixedSession(data, {
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
          title="Create Fixed Session"
          subtitle="Set up a fixed session with specific start and end dates."
        />

        <FixedSessionForm onSubmit={handleSubmit} onSubmitRef={submitRef} />
      </div>

      <SessionFormFooter
        campId={campId}
        onCancel={handleCancel}
        onSubmit={handleFooterSubmit}
        isSubmitting={isCreatingFixed}
        mode="create"
      />
    </>
  )
}
