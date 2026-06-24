'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'

/**
 * Redirect page for the legacy /applications route — provider applications now live under the
 * Providers section's Pending Review tab.
 */
export default function ApplicationsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/providers/pending-review')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" color="primary" />
    </div>
  )
}
