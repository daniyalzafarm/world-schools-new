'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@heroui/react'
import type { SessionType } from '@/types/sessions'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import { SessionTypeSelector } from './SessionTypeSelector'
import { FlexibleSessionsManager } from './flexible/FlexibleSessionsManager'
import { FixedSessionsManager } from './fixed/FixedSessionsManager'

interface SessionsPageProps {
  campId: string
}

/**
 * Sessions Page Component
 * Main entry point for session management
 * Handles session type selection and routing to appropriate manager
 */
export function SessionsPage({ campId }: SessionsPageProps) {
  const { sessions, sessionType, canChangeType, isLoading, reload } = useSessionsData(campId)
  const { setSessionType, isSettingType } = useSessionMutations(campId)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [forceShowTypeSelector, setForceShowTypeSelector] = useState(false)

  // Determine if we need to show the type selector
  useEffect(() => {
    if (!isLoading) {
      // Show type selector if:
      // 1. No session type is set AND
      // 2. No sessions exist (canChangeType is true)
      const needsTypeSelection = !sessionType && canChangeType
      setShowTypeSelector(needsTypeSelection)
    }
  }, [isLoading, sessionType, canChangeType])

  // Handle session type selection
  const handleTypeSelected = async (type: SessionType) => {
    try {
      await setSessionType(type, {
        onSuccess: async () => {
          // Reload session data to get the updated session type
          await reload()
          setShowTypeSelector(false)
          setForceShowTypeSelector(false)
        },
      })
    } catch (error) {
      console.error('Failed to set session type:', error)
    }
  }

  // Handle request to change session type
  const handleChangeSessionType = () => {
    setForceShowTypeSelector(true)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  // Show type selector if needed or forced
  if (showTypeSelector || forceShowTypeSelector) {
    return (
      <SessionTypeSelector
        campId={campId}
        currentType={sessionType}
        onTypeSelected={handleTypeSelected}
        isLoading={isSettingType}
      />
    )
  }

  // Show appropriate manager based on session type
  if (sessionType === 'flexible') {
    return <FlexibleSessionsManager campId={campId} onChangeSessionType={handleChangeSessionType} />
  }

  if (sessionType === 'fixed') {
    return <FixedSessionsManager campId={campId} onChangeSessionType={handleChangeSessionType} />
  }

  // Fallback - should not reach here
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-2">
        <p className="text-[16px] text-default-600">No session type configured</p>
        <p className="text-[14px] text-default-500">Please contact support</p>
      </div>
    </div>
  )
}
