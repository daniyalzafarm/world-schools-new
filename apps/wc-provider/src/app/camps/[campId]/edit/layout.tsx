'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useCampsStore } from '@/stores/camps-store'
import { CampEditorSidebar } from '@/components/camps/CampEditorSidebar'
import { CampEditorTopBar } from '@/components/camps/CampEditorTopBar'
import { CampEditorFooter } from '@/components/camps/CampEditorFooter'
import {
  CampEditorLayoutProvider,
  useCampEditorLayout,
} from '@/components/camps/CampEditorLayoutContext'
import { Logo } from '@/components/layout/logo'

function CampEditorLayoutContent({
  children,
  campId,
}: {
  children: React.ReactNode
  campId: string
}) {
  const { fetchCamp } = useCampsStore()
  const { rightSidebar } = useCampEditorLayout()

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
      })
    }
  }, [campId, fetchCamp])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center bg-white px-6 md:hidden">
        <Logo size="md" />
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <CampEditorSidebar campId={campId} />
      </div>

      {/* Main Content - Full height with flex layout */}
      <main className="flex h-full flex-1 overflow-hidden pt-16 md:ml-72 md:pt-0">
        {/* Left Column: Main Content Area (Top Bar + Content + Footer) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar - Sticky with reserved space */}
          <div className="sticky top-0 z-40 shrink-0">
            <CampEditorTopBar campId={campId} />
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-12 py-8">{children}</div>
          </div>

          {/* Footer - Sticky with reserved space */}
          <div className="sticky bottom-0 z-40 shrink-0">
            <CampEditorFooter campId={campId} />
          </div>
        </div>

        {/* Right Column: Optional Sidebar (Full Height) with Slide Animation */}
        <div
          className={`hidden h-full shrink-0 overflow-y-auto border-l border-default-200 bg-background transition-all duration-300 ease-in-out lg:block ${
            rightSidebar
              ? 'w-96 lg:w-[480px] translate-x-0 opacity-100'
              : 'lg:w-0 xl:w-0 translate-x-full opacity-0'
          }`}
        >
          {rightSidebar}
        </div>
      </main>
    </div>
  )
}

export default function CampEditorLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const campId = params.campId as string

  return (
    <CampEditorLayoutProvider>
      <CampEditorLayoutContent campId={campId}>{children}</CampEditorLayoutContent>
    </CampEditorLayoutProvider>
  )
}
