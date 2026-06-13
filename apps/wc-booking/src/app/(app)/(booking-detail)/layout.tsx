'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'

/**
 * Standalone shell for booking detail: no app sidebar (unlike dashboard routes).
 * Uses full viewport height; inner route supplies top bar + sidebar + map.
 */
export default function BookingDetailRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-slate-900">
        {children}
      </div>
    </ProtectedRoute>
  )
}
