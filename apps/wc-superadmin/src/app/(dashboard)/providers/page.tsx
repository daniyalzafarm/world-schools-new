'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { getFirstAccessibleRoute } from '@/utils/navigation'

/**
 * `/providers` is a redirect entry — send each role to the first tab it can actually use:
 * application reviewers land on Pending review, provider managers on Approved.
 */
export default function AllProvidersPage() {
  const router = useRouter()
  const { hasPermission, permissions } = usePermissions()

  useEffect(() => {
    if (hasPermission('provider_applications.read')) {
      router.replace('/providers/pending-review')
    } else if (hasPermission('providers.read')) {
      router.replace('/providers/approved')
    } else {
      router.replace(getFirstAccessibleRoute(permissions) ?? '/404')
    }
  }, [hasPermission, permissions, router])

  return null
}
