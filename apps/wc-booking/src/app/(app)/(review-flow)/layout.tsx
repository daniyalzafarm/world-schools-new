'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'

/**
 * Full-screen flows (e.g. write review wizard) without dashboard sidebar or reviews layout.
 */
export default function ReviewFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="min-h-dvh bg-white text-default-900 dark:bg-slate-900 dark:text-white">
        {children}
      </div>
    </ProtectedRoute>
  )
}
