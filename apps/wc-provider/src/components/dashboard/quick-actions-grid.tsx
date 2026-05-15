import React from 'react'

interface QuickActionsGridProps {
  children: React.ReactNode
}

export function QuickActionsGrid({ children }: QuickActionsGridProps) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}
