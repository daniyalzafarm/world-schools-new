'use client'

import { usePathname } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHelp = pathname?.startsWith('/help')
  const isSupportTicketDetail = pathname?.startsWith('/support/tickets/')

  return (
    <MainLayout allowPublic={isHelp}>
      {isHelp ? (
        <div className="min-h-full">{children}</div>
      ) : isSupportTicketDetail ? (
        <div className="h-full min-h-0">{children}</div>
      ) : (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
      )}
    </MainLayout>
  )
}
