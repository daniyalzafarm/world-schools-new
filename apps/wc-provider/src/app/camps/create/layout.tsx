'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../../stores/auth-store'
import { useCampsStore } from '../../../stores/camps-store'
import { CampWizardSidebar } from '../../../components/camps/CampWizardSidebar'
import { CampWizardTopBar } from '../../../components/camps/CampWizardTopBar'
import { CampWizardFooter } from '../../../components/camps/CampWizardFooter'
import { Logo } from '@/components/layout/logo'

export default function CampCreateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { wizardCamp, wizardStep } = useCampsStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin')
      return
    }
  }, [isAuthenticated, router])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-[60px] items-center bg-white px-6 md:hidden">
        <Logo size="md" />
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <CampWizardSidebar currentStep={wizardStep} campId={wizardCamp?.id} />
      </div>

      {/* Main Content - Full height with flex column layout */}
      <main className="flex h-full flex-1 flex-col pt-[60px] md:ml-[280px] md:pt-0">
        {/* Top Bar - Sticky with reserved space */}
        <div className="sticky top-0 z-40 shrink-0">
          <CampWizardTopBar currentStep={wizardStep} campId={wizardCamp?.id} />
        </div>

        {/* Scrollable Content Area - fills remaining space */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-12 py-8">{children}</div>
        </div>

        {/* Footer - Sticky with reserved space */}
        <div className="sticky bottom-0 z-40 shrink-0">
          <CampWizardFooter currentStep={wizardStep} campId={wizardCamp?.id} />
        </div>
      </main>
    </div>
  )
}
