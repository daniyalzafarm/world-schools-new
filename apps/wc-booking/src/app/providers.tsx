'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { ConfirmDialogProvider } from '@world-schools/ui-web'
import { WebSocketProvider } from '@world-schools/wc-frontend-utils'

import { AuthProvider } from '@/components/auth/auth-provider'
import { MessagingProvider } from '@/components/messaging/messaging-provider'
import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'

/**
 * UI / theme providers shared by ALL routes (public + authenticated).
 * These are SSR-safe and non-blocking, so they can wrap server-rendered
 * public pages (e.g. the camp profile) without hiding content from crawlers.
 */
export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        storageKey="wc-booking-theme"
      >
        <ToastProvider placement="top-right" toastOffset={10} />
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </ThemeProvider>
    </HeroUIProvider>
  )
}

/**
 * Auth / realtime providers for the authenticated app only.
 *
 * AuthProvider blocks render with a loading spinner until client-side auth
 * initialization completes, so it must NOT wrap public (SEO) routes — doing so
 * would make those pages server-render as a spinner instead of real content.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <AuthProvider>
      <WebSocketProvider
        wsService={globalWsService}
        userId={user?.id}
        isAuthenticated={isAuthenticated}
      >
        <MessagingProvider>{children}</MessagingProvider>
      </WebSocketProvider>
    </AuthProvider>
  )
}
