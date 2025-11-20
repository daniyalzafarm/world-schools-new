'use client'

import TopNav from '@/components/layout/top-nav'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ComingSoon />
      </main>
    </div>
  )
}
