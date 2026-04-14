import { useEffect, useState } from 'react'
import type { ApiResult } from '@world-schools/wc-utils'
import type { SupportTicketCategory } from '@world-schools/wc-types'

/**
 * Fetches the list of categories available for the current user type
 * (PARENT for wc-booking, PROVIDER for wc-provider).
 *
 * Falls back to an empty array on error — the consuming component should
 * handle the `error` state to show a message or fallback UI.
 */
export function useSupportTicketCategories(
  fetchCategories: () => Promise<ApiResult<SupportTicketCategory[]>>
) {
  const [categories, setCategories] = useState<SupportTicketCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchCategories()
      .then(result => {
        if (result.success) {
          setCategories(result.data)
        } else {
          setError('Failed to load categories.')
        }
      })
      .catch(() => setError('Failed to load categories.'))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error }
}
