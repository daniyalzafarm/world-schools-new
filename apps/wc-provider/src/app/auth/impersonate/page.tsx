'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Spinner } from '@heroui/react'
import apiClient from '@/utils/api-client'

function ImpersonateContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // Guard against React StrictMode double-invoking this effect in dev. The second call
  // would 401 (the impersonation token is single-use), which would trigger the apiClient's
  // refresh interceptor and overwrite the freshly-minted impersonation cookies.
  const hasExchanged = useRef(false)

  useEffect(() => {
    if (hasExchanged.current) return
    hasExchanged.current = true

    const token = searchParams.get('token')

    if (!token) {
      setError('No impersonation token provided.')
      return
    }

    const exchange = async () => {
      const result = await apiClient.post('/provider/auth/impersonate/exchange', { token })

      if (!result.success) {
        setError(
          'This link has expired or is invalid. Please ask your administrator to generate a new one.'
        )
        return
      }

      // Use a full page reload so the auth store re-initialises from scratch with the
      // newly set cookies/tokens in place. A client-side router.replace('/') would keep
      // the already-initialised auth store (isAuthenticated: false) and redirect to signin.
      window.location.replace('/')
    }

    void exchange()
  }, [searchParams])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900 px-4">
        <div className="text-center max-w-md">
          <div className="mb-4 text-4xl">🔒</div>
          <h1 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-200">
            Session link invalid
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
      <div className="text-center">
        <Spinner size="lg" color="primary" className="mb-4" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Opening provider session…</p>
      </div>
    </div>
  )
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" color="primary" />
        </div>
      }
    >
      <ImpersonateContent />
    </Suspense>
  )
}
