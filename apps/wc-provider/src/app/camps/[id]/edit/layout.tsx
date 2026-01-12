'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import { CampEditorSidebar } from '../../../../components/camps/CampEditorSidebar'
import { CampEditorTopBar } from '../../../../components/camps/CampEditorTopBar'
import { CampEditorFooter } from '../../../../components/camps/CampEditorFooter'

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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Editor Sidebar */}
      <CampEditorSidebar campId={campId} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden pl-[280px]">
        {/* Top Bar */}
        <CampEditorTopBar campId={campId} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-[80px]">{children}</main>

        {/* Footer */}
        <CampEditorFooter campId={campId} />
      </div>
    </div>
  )
}
