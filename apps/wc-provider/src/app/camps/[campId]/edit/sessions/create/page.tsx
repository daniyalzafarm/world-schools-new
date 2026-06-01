'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import { SessionForm, type SessionFormData } from '@/components/sessions/SessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { useCampsStore } from '@/stores/camps-store'
import type { CampType } from '@/types/camps'
import type { GlobalDiscount, SessionSpecificDiscount } from '@/types/discounts'
import { getGlobalDiscounts } from '@/services/discounts.service'
import type { CreateSessionDto } from '@/types/sessions'
import { addToast } from '@heroui/react'

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
  const [globalDiscounts, setGlobalDiscounts] = useState<GlobalDiscount[]>([])
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([])
  const [initialEnabledDiscountIds, setInitialEnabledDiscountIds] = useState<string[]>([])
  const [removedDiscountIds, setRemovedDiscountIds] = useState<string[]>([])
  const [sessionSpecificDiscounts, setSessionSpecificDiscounts] = useState<
    Omit<SessionSpecificDiscount, 'id'>[]
  >([])

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

  // Fetch global discounts
  useEffect(() => {
    if (campId) {
      getGlobalDiscounts(campId)
        .then(discounts => {
          setGlobalDiscounts(discounts)
          // Set all enabled discounts as selected by default
          const enabledIds = discounts.filter(d => d.isEnabled && d.entries.length).map(d => d.id)
          setSelectedDiscountIds(enabledIds)
          setInitialEnabledDiscountIds(enabledIds)
        })
        .catch(error => {
          console.error('Failed to fetch global discounts:', error)
        })
    }
  }, [campId])

  // Handle discount toggle
  const handleToggleDiscount = (discountId: string) => {
    setSelectedDiscountIds(prev => {
      const isCurrentlySelected = prev.includes(discountId)

      if (isCurrentlySelected) {
        // Removing the discount
        // If it was initially enabled (auto-selected), track it as removed
        if (initialEnabledDiscountIds.includes(discountId)) {
          setRemovedDiscountIds(prevRemoved => {
            const newRemoved = prevRemoved.includes(discountId)
              ? prevRemoved
              : [...prevRemoved, discountId]
            return newRemoved
          })
        }

        const newSelected = prev.filter(id => id !== discountId)
        return newSelected
      } else {
        // Adding the discount

        // If it was previously removed, remove it from the removed list
        setRemovedDiscountIds(prevRemoved => {
          const newRemoved = prevRemoved.filter(id => id !== discountId)
          return newRemoved
        })

        const newSelected = [...prev, discountId]
        return newSelected
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
    const createData: CreateSessionDto = {
      ...data,
      globalAppliedDiscountIds: selectedDiscountIds,
      globalRemovedDiscountIds: removedDiscountIds,
      sessionSpecificDiscounts: sessionSpecificDiscounts,
    }
    await createSession(createData, {
      onSuccess: () => {
        router.push(`/camps/${campId}/edit/sessions`)
      },
      onError: err => {
        addToast({
          title: 'Error!',
          description: err.message,
          color: 'danger',
        })
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

  if (!currentCamp) return null

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
        isSubmitting={isCreating}
        mode="create"
      />
    </>
  )
}
