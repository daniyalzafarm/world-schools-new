'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { Menu, X } from 'lucide-react'
import { AccountSidebar } from '@/components/layout/account-sidebar'
import { eventBus } from '@world-schools/wc-utils'

const AccountLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Emit sidebar collapse event when account page mounts.
  // Account is under (dashboard), so the main Sidebar stays mounted and receives this.
  useEffect(() => {
    eventBus.$emit('sidebar:collapse')
  }, [])

  return (
    <>
      <div className="absolute inset-0 lg:left-0">
        <div className="flex h-full bg-white dark:bg-slate-900">
          <AccountSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Account</h1>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
              >
                <div className="relative w-6 h-6">
                  <Menu
                    size={20}
                    className={cn(
                      'absolute inset-0 transition-all duration-200',
                      sidebarOpen
                        ? 'opacity-0 rotate-90 scale-75'
                        : 'opacity-100 rotate-0 scale-100'
                    )}
                  />
                  <X
                    size={20}
                    className={cn(
                      'absolute inset-0 transition-all duration-200',
                      sidebarOpen
                        ? 'opacity-100 rotate-0 scale-100'
                        : 'opacity-0 -rotate-90 scale-75'
                    )}
                  />
                </div>
              </Button>
            </div>
          </div>

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
