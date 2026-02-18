'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

interface ChildDetailFormState {
  isModified: boolean
  isSaving: boolean
  formSubmit?: () => Promise<void>
}

interface ChildDetailContextValue {
  formState: ChildDetailFormState
  setFormState: (state: Partial<ChildDetailFormState>) => void
  registerFormSubmit: (submitFn: () => Promise<void>) => void
}

const ChildDetailContext = createContext<ChildDetailContextValue | undefined>(undefined)

export function ChildDetailProvider({ children }: { children: React.ReactNode }) {
  const [formState, setFormStateInternal] = useState<ChildDetailFormState>({
    isModified: false,
    isSaving: false,
  })

  const setFormState = useCallback((state: Partial<ChildDetailFormState>) => {
    setFormStateInternal(prev => ({ ...prev, ...state }))
  }, [])

  const registerFormSubmit = useCallback((submitFn: () => Promise<void>) => {
    setFormStateInternal(prev => ({ ...prev, formSubmit: submitFn }))
  }, [])

  return (
    <ChildDetailContext.Provider value={{ formState, setFormState, registerFormSubmit }}>
      {children}
    </ChildDetailContext.Provider>
  )
}

export function useChildDetailContext() {
  const context = useContext(ChildDetailContext)
  if (!context) {
    throw new Error('useChildDetailContext must be used within ChildDetailProvider')
  }
  return context
}
