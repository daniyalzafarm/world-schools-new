'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FlexibleSessionForm,
  type FlexibleSessionFormData,
} from '@/components/sessions/flexible/FlexibleSessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import type { FlexibleSession } from '@/types/sessions'
import { useCampsStore } from '@/stores/camps-store'

/**
 * Edit Flexible Session Page
 * Standalone page for editing an existing flexible session
 */
export default function EditFlexibleSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const sessionId = params.sessionId as string
  const submitRef = useRef<(() => void) | undefined>(undefined)

  const { flexibleSessions, isLoading } = useSessionsData(campId)
  const { updateFlexibleSession, isUpdatingFlexible } = useSessionMutations(campId)
  const { currentCamp, fetchCamp, isLoading: isCampLoading } = useCampsStore()

  const [session, setSession] = useState<FlexibleSession | null>(null)

  // Fetch camp data to get gender setting
  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
      })
    }
  }, [campId, fetchCamp])

  // Find the session to edit
  useEffect(() => {
    if (!isLoading && flexibleSessions) {
      const foundSession = flexibleSessions.find(s => s.id === sessionId)
      if (foundSession) {
        setSession(foundSession)
      }
    }
  }, [isLoading, flexibleSessions, sessionId])

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

    await updateFlexibleSession(sessionId, dto, {
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
  if (isLoading || isCampLoading || !session || !currentCamp) {
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
          subtitle="Update the flexible session details."
        />

        <FlexibleSessionForm
          session={session}
          onSubmit={handleSubmit}
          onSubmitRef={submitRef}
          campGender={currentCamp.gender}
        />
      </div>

      <SessionFormFooter
        campId={campId}
        onCancel={handleCancel}
        onSubmit={handleFooterSubmit}
        isSubmitting={isUpdatingFlexible}
        mode="edit"
      />
    </>
  )
}
