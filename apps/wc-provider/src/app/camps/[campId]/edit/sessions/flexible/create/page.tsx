'use client'

import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FlexibleSessionForm,
  type FlexibleSessionFormData,
} from '@/components/sessions/flexible/FlexibleSessionForm'
import { useSessionMutations } from '@/hooks/useSessionMutations'

/**
 * Create Flexible Session Page
 * Standalone page for creating a new flexible session
 */
export default function CreateFlexibleSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string

  const { createFlexibleSession, isCreatingFlexible } = useSessionMutations(campId)

  // Handle form submit
  const handleSubmit = async (data: FlexibleSessionFormData) => {
    await createFlexibleSession(data, {
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
        title="Create Flexible Session"
        subtitle="Set up a flexible session where parents can choose their own start date and duration."
      />

      <FlexibleSessionForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isCreatingFlexible}
      />
    </div>
  )
}
