'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FlexibleSessionForm,
  type FlexibleSessionFormData,
} from '@/components/sessions/flexible/FlexibleSessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useCampsStore } from '@/stores/camps-store'
import { Spinner } from '@heroui/react'

/**
 * Create Flexible Session Page
 * Standalone page for creating a new flexible session
 */
export default function CreateFlexibleSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const submitRef = useRef<(() => void) | undefined>(undefined)

  const { createFlexibleSession, isCreatingFlexible } = useSessionMutations(campId)
  const { currentCamp, fetchCamp, isLoading } = useCampsStore()

  // Fetch camp data to get gender setting
  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
      })
    }
  }, [campId, fetchCamp])

  // Handle form submit
  const handleSubmit = async (data: FlexibleSessionFormData) => {
    // Transform form data to DTO (convert null to undefined)
    const dto = {
      ...data,
      capacity: data.capacity ?? undefined,
      basePricePerDay: data.basePricePerDay ?? undefined,
      minDaysLimit: data.minDaysLimit ?? undefined,
      maxDaysLimit: data.maxDaysLimit ?? undefined,
      ageRange: data.ageRange ?? undefined,
      boysCapacity: data.boysCapacity ?? undefined,
      girlsCapacity: data.girlsCapacity ?? undefined,
      separateGenderCapacity: data.separateGenderCapacity,
    }

    await createFlexibleSession(dto, {
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

  if (isLoading || !currentCamp) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Add padding-bottom to prevent content from being hidden behind fixed footer */}
      <div className="pb-20">
        <SessionBreadcrumb
          title="Create Flexible Session"
          subtitle="Set up a flexible session where parents can choose their own start date and duration."
        />

        <FlexibleSessionForm
          onSubmit={handleSubmit}
          onSubmitRef={submitRef}
          campGender={currentCamp.gender}
        />
      </div>

      <SessionFormFooter
        campId={campId}
        onCancel={handleCancel}
        onSubmit={handleFooterSubmit}
        isSubmitting={isCreatingFlexible}
        mode="create"
      />
    </>
  )
}
