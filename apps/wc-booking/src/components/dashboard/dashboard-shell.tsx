import React from 'react'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-12 lg:py-8">
      {children}
    </div>
  )
}
