'use client'

import TopNav from '@/components/layout/top-nav'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
