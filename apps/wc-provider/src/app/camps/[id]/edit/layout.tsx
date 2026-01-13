'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import { CampEditorSidebar } from '../../../../components/camps/CampEditorSidebar'
import { CampEditorTopBar } from '../../../../components/camps/CampEditorTopBar'
import { CampEditorFooter } from '../../../../components/camps/CampEditorFooter'
import Image from 'next/image'

export default function CampEditorLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const campId = params.id as string
  const { fetchCamp, currentCamp: _currentCamp } = useCampsStore()

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
      <div className="fixed left-0 right-0 top-0 z-50 flex h-[60px] items-center bg-white px-6 md:hidden">
        <Image
          src="/images/logo-mobile.svg"
          alt="World-Camps"
          width={36}
          height={36}
          className="h-9 w-auto"
        />
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <CampEditorSidebar campId={campId} />
      </div>

      {/* Main Content - Full height with flex column layout */}
      <main className="flex h-full flex-1 flex-col pt-[60px] md:ml-[280px] md:pt-0">
        {/* Top Bar - Sticky with reserved space */}
        <div className="sticky top-0 z-40 shrink-0">
          <CampEditorTopBar campId={campId} />
        </div>

        {/* Scrollable Content Area - fills remaining space */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-12 py-8">{children}</div>
        </div>

        {/* Footer - Sticky with reserved space */}
        <div className="sticky bottom-0 z-40 shrink-0">
          <CampEditorFooter campId={campId} />
        </div>
      </main>
    </div>
  )
}
