'use client'

import MainLayout from '@/components/layout/main-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true} requireUser={true}>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  )
}
