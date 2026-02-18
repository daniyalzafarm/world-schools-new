import { useEffect } from 'react'

/**
 * Hook to warn users before leaving the page with unsaved changes
 *
 * @param isModified - Whether the form has unsaved changes
 * @param message - Optional custom message (browsers may not display this)
 *
 * @example
 * ```tsx
 * const [isModified, setIsModified] = useState(false)
 * useBeforeUnload(isModified)
 * ```
 */
export function useBeforeUnload(isModified: boolean, message?: string) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isModified) {
        // Modern browsers ignore custom messages and show their own
        // But we still need to set returnValue for the dialog to appear
        e.preventDefault()
        e.returnValue = message || ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isModified, message])
}
