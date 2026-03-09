'use client'

import React, { createContext, useMemo, useContext } from 'react'
import {
  createKbHelpService,
  type KbHelpApiClient,
  type KbHelpContext,
  type KbHelpService,
} from './create-kb-help-service'

/** Maps audience to API context (user | provider | staff) for dynamic KB routes. */
function audienceToContext(audience: string[]): KbHelpContext {
  const first = audience?.[0]?.toLowerCase()
  if (first === 'providers') return 'provider'
  if (first === 'staff') return 'staff'
  return 'user' // parents or default
}

export interface HelpKbConfig {
  basePath: string
  audience: string[]
  supportHref: string
}

export interface HelpKbContextValue {
  service: KbHelpService
  basePath: string
  audience: string[]
  supportHref: string
}

const HelpKbContext = createContext<HelpKbContextValue | null>(null)

export interface HelpKbProviderProps {
  apiClient: KbHelpApiClient
  basePath: string
  audience: string[]
  supportHref: string
  children: React.ReactNode
}

export function HelpKbProvider({
  apiClient,
  basePath,
  audience,
  supportHref,
  children,
}: HelpKbProviderProps) {
  const value = useMemo<HelpKbContextValue>(() => {
    const context: KbHelpContext = audienceToContext(audience)
    const service = createKbHelpService(apiClient, context)
    return { service, basePath, audience, supportHref }
  }, [apiClient, basePath, audience, supportHref])

  return <HelpKbContext.Provider value={value}>{children}</HelpKbContext.Provider>
}

export function useHelpKb(): HelpKbContextValue {
  const ctx = useContext(HelpKbContext)
  if (!ctx) {
    throw new Error('useHelpKb must be used within HelpKbProvider')
  }
  return ctx
}
