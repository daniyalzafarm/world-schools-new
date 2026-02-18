'use client'

import { MainLayout } from '@/components/layout/main-layout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
    </MainLayout>
  )
}
