'use client'

import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/use-permissions'

interface CanProps {
  /** A single permission id, or a list of permission ids. */
  permission: string | string[]
  /** When `permission` is a list, require ALL of them (default: ANY). */
  requireAll?: boolean
  children: ReactNode
  /** Rendered when the user lacks the required permission(s). Defaults to nothing. */
  fallback?: ReactNode
}

/**
 * Conditionally renders children only when the current user holds the required permission(s).
 * Use this to gate action controls (buttons, menu items, links) so the UI matches what the
 * backend actually allows — the API enforces the same permission server-side.
 */
export function Can({ permission, requireAll = false, children, fallback = null }: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()

  const permitted = Array.isArray(permission)
    ? requireAll
      ? hasAllPermissions(permission)
      : hasAnyPermission(permission)
    : hasPermission(permission)

  return <>{permitted ? children : fallback}</>
}
