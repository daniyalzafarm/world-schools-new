'use client'

import React, { createContext, type ReactNode, useContext, useState } from 'react'

interface CampEditorLayoutContextType {
  rightSidebar: ReactNode | null
  setRightSidebar: (sidebar: ReactNode | null) => void
}

const CampEditorLayoutContext = createContext<CampEditorLayoutContextType | undefined>(undefined)

/**
 * CampEditorLayoutProvider
 *
 * Provides context for managing the right sidebar in the camp editor layout.
 * This allows child pages to communicate with the parent layout to display
 * an optional right sidebar (similar to OnboardingPageLayout pattern).
 */
export function CampEditorLayoutProvider({ children }: { children: ReactNode }) {
  const [rightSidebar, setRightSidebar] = useState<ReactNode | null>(null)

  return (
    <CampEditorLayoutContext.Provider value={{ rightSidebar, setRightSidebar }}>
      {children}
    </CampEditorLayoutContext.Provider>
  )
}

/**
 * useCampEditorLayout
 *
 * Hook to access the camp editor layout context.
 * Used by child pages to set the right sidebar content.
 */
export function useCampEditorLayout() {
  const context = useContext(CampEditorLayoutContext)
  if (context === undefined) {
    throw new Error('useCampEditorLayout must be used within a CampEditorLayoutProvider')
  }
  return context
}
