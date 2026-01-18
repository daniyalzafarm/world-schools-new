'use client'

import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FixedSessionForm,
  type FixedSessionFormData,
} from '@/components/sessions/fixed/FixedSessionForm'
import { useSessionMutations } from '@/hooks/useSessionMutations'

/**
 * Create Fixed Session Page
 * Standalone page for creating a new fixed session
 */
export default function CreateFixedSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string

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

  return (
    <div className="max-w-4xl mx-auto">
      <SessionBreadcrumb
        campId={campId}
        title="Create Fixed Session"
        subtitle="Set up a fixed session with specific start and end dates."
      />

      <FixedSessionForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isCreatingFixed}
      />
    </div>
  )
}
