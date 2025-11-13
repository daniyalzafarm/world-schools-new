'use client'

import React, { useState } from 'react'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { Sidebar } from '@/components/layout/sidebar'
import { TopNav } from '@/components/layout/top-nav'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <ProtectedRoute requireAuth requireSuperAdmin>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          <div className="flex-1 flex flex-col min-h-screen">
            <TopNav onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
            <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/70 dark:bg-slate-950">
              <div className="max-w-7xl mx-auto space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
