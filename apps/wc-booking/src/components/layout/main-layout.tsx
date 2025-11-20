'use client'

import React from 'react'

import { ProtectedRoute } from '@/components/auth/protected-route'
import TopNav from '@/components/layout/top-nav'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        {/* Top Navigation */}
        <TopNav />

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
