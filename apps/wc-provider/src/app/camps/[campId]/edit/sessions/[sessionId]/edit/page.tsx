'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import { SessionForm, type SessionFormData } from '@/components/sessions/SessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionsStore } from '@/stores/sessions-store'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useCampsStore } from '@/stores/camps-store'
import { getGlobalDiscounts } from '@/services/discounts.service'
import type { CampType } from '@/types/camps'
import type { GlobalDiscount, SessionSpecificDiscount } from '@/types/discounts'

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

  // Zustand stores
  const isLoading = useSessionsStore(state => state.isLoading)
  const loadSessions = useSessionsStore(state => state.loadSessions)
  const getSessionById = useSessionsStore(state => state.getSessionById)

  const { updateSession, isUpdating } = useSessionMutations(campId)
  const { fetchCamp, currentCamp } = useCampsStore()

  const [campType, setCampType] = useState<CampType | null>(null)
  const [globalDiscounts, setGlobalDiscounts] = useState<GlobalDiscount[]>([])
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([])
  const [initialAppliedDiscountIds, setInitialAppliedDiscountIds] = useState<string[]>([])
  const [removedDiscountIds, setRemovedDiscountIds] = useState<string[]>([])
  const [sessionSpecificDiscounts, setSessionSpecificDiscounts] = useState<
    Omit<SessionSpecificDiscount, 'id'>[]
  >([])

  // Load sessions when component mounts
  useEffect(() => {
    void loadSessions(campId)
  }, [campId, loadSessions])

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

  // Get the session from the store
  const session = getSessionById(sessionId)

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

  // Initialize discount state from session when session loads
  useEffect(() => {
    if (session?.discounts) {
      const appliedIds = session.discounts.globalApplied || []
      setSelectedDiscountIds(appliedIds)
      setInitialAppliedDiscountIds(appliedIds)
      setSessionSpecificDiscounts(
        (session.discounts.sessionSpecific || []).map(({ id: _id, ...rest }) => rest)
      )
    }
  }, [session])

  // Handle discount toggle
  const handleToggleDiscount = (discountId: string) => {
    setSelectedDiscountIds(prev => {
      const isCurrentlySelected = prev.includes(discountId)

      if (isCurrentlySelected) {
        // Removing the discount
        // If it was initially applied to the session, track it as removed
        if (initialAppliedDiscountIds.includes(discountId)) {
          setRemovedDiscountIds(prevRemoved =>
            prevRemoved.includes(discountId) ? prevRemoved : [...prevRemoved, discountId]
          )
        }
        return prev.filter(id => id !== discountId)
      } else {
        // Adding the discount
        // If it was previously removed, remove it from the removed list
        setRemovedDiscountIds(prevRemoved => prevRemoved.filter(id => id !== discountId))
        return [...prev, discountId]
      }
    })
  }

  // Handle add session-specific discount
  const handleAddSessionDiscount = (discount: Omit<SessionSpecificDiscount, 'id'>) => {
    setSessionSpecificDiscounts(prev => [...prev, discount])
  }

  // Handle remove session-specific discount
  const handleRemoveSessionDiscount = (index: number) => {
    setSessionSpecificDiscounts(prev => prev.filter((_, i) => i !== index))
  }

  // Handle form submit
  const handleSubmit = async (data: SessionFormData) => {
    await updateSession(
      sessionId,
      {
        ...data,
        globalAppliedDiscountIds: selectedDiscountIds,
        globalRemovedDiscountIds: removedDiscountIds,
        sessionSpecificDiscounts: sessionSpecificDiscounts,
      },
      {
        onSuccess: () => {
          router.push(`/camps/${campId}/edit/sessions`)
        },
      }
    )
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
          globalDiscounts={globalDiscounts}
          selectedDiscountIds={selectedDiscountIds}
          onToggleDiscount={handleToggleDiscount}
          sessionSpecificDiscounts={sessionSpecificDiscounts}
          onAddSessionDiscount={handleAddSessionDiscount}
          onRemoveSessionDiscount={handleRemoveSessionDiscount}
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
