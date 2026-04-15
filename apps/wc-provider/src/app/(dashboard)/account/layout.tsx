'use client'

import React, { useEffect } from 'react'
import { AccountSidebar } from '@/components/layout/account-sidebar'
import { eventBus } from '@world-schools/wc-utils'

const AccountLayout = ({ children }: { children: React.ReactNode }) => {
  // Emit sidebar collapse event when account page mounts.
  // Account is under (dashboard), so the main Sidebar stays mounted and receives this.
  useEffect(() => {
    eventBus.$emit('sidebar:collapse')
  }, [])

  return (
    <>
      <div className="absolute inset-0 lg:left-0">
        <div className="flex h-full bg-white dark:bg-slate-900">
          <AccountSidebar sidebarOpen={false} setSidebarOpen={() => {}} />

          <main className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default AccountLayout
