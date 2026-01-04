'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'

/**
 * Redirect page for legacy /applications route
 * This route has been consolidated into /provider-requests
 */
export default function ApplicationsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/provider-requests')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" color="primary" />
    </div>
  )
}
