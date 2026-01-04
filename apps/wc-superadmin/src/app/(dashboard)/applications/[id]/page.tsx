'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'

/**
 * Redirect page for legacy /applications/[id] route
 * This route has been consolidated into /provider-requests/[id]
 */
export default function ApplicationDetailRedirect() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    if (id) {
      router.replace(`/provider-requests/${id}`)
    } else {
      router.replace('/provider-requests')
    }
  }, [router, id])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" color="primary" />
    </div>
  )
}
