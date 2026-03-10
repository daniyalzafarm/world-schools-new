'use client'

import { HelpKbProvider } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <HelpKbProvider
      apiClient={apiClient}
      basePath="/help"
      audience={['parents']}
      supportHref="/support/tickets"
    >
      <div className="min-h-full">{children}</div>
    </HelpKbProvider>
  )
}
