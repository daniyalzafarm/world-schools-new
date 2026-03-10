'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { ConfirmDialogProvider } from '@world-schools/ui-web'
import { WebSocketProvider } from '@world-schools/wc-frontend-utils'

import { AuthProvider } from '@/components/auth/auth-provider'
import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'

export function Providers({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <HeroUIProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        storageKey="wc-superadmin-theme"
      >
        <ToastProvider placement="top-right" toastOffset={10} />
        <ConfirmDialogProvider>
          <AuthProvider>
            <WebSocketProvider
              wsService={globalWsService}
              userId={user?.id}
              isAuthenticated={isAuthenticated}
            >
              {children}
            </WebSocketProvider>
          </AuthProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </HeroUIProvider>
  )
}
