'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { MessagesMainLayout } from '@/components/layout/messages-main-layout'

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <MessagesMainLayout>
        <div className="h-full flex flex-col">{children}</div>
      </MessagesMainLayout>
    </ProtectedRoute>
  )
}
