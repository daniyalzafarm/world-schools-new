'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function HomePage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <ComingSoon />
      </div>
    </MainLayout>
  )
}
