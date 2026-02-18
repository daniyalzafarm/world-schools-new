'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { ConfirmDialogProvider } from '@world-schools/ui-web'
import { WebSocketProvider } from '@world-schools/wc-frontend-utils'

import { AuthProvider } from '@/components/auth/auth-provider'
import { MessagingProvider } from '@/components/messaging/messaging-provider'
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
        storageKey="wc-provider-theme"
      >
        <ToastProvider placement="top-right" toastOffset={10} />
        <ConfirmDialogProvider>
          <AuthProvider>
            <WebSocketProvider
              wsService={globalWsService}
              userId={user?.id}
              isAuthenticated={isAuthenticated}
            >
              <MessagingProvider>{children}</MessagingProvider>
            </WebSocketProvider>
          </AuthProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </HeroUIProvider>
  )
}
