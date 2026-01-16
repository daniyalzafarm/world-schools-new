'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '@/stores/camps-store'
import { SessionsPage } from '@/components/sessions'

/**
 * Camp Wizard - Sessions Page
 * Step 5: Configure camp sessions (flexible or fixed)
 */
export default function WizardSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const { wizardCamp, setWizardStep } = useCampsStore()

  // Set current step
  useEffect(() => {
    setWizardStep(5)
  }, [setWizardStep])

  // Use campId from params or store
  const campId = (params.campId as string) || wizardCamp?.id

  // Redirect if no camp ID
  useEffect(() => {
    if (!campId) {
      router.push('/camps/create/basic-info')
    }
  }, [campId, router])

  if (!campId) {
    return null
  }

  return (
    <div className="w-full">
      <SessionsPage campId={campId} />
    </div>
  )
}
