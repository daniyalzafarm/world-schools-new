import type { ReactNode } from 'react'

export default function BookingGroupDetailLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>
}
