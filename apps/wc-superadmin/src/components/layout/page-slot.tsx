import React from 'react'

interface PageSlotProps {
  children: React.ReactNode
}

export function PageSlot({ children }: PageSlotProps) {
  return <div className="p-6 lg:p-8">{children}</div>
}
