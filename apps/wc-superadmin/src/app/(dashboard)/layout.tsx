'use client'

import { usePathname } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHelp = pathname?.startsWith('/help')

  return (
    <MainLayout allowPublic={isHelp}>
      {isHelp ? <div className="min-h-full">{children}</div> : children}
    </MainLayout>
  )
}
