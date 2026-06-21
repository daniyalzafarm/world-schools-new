'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ConfirmDialogProvider } from '@world-schools/ui-web'
import { WebSocketProvider } from '@world-schools/wc-frontend-utils'

import { AuthProvider } from '@/components/auth/auth-provider'
import { AuthModal } from '@/components/auth/auth-modal'
import { GoogleOneTap } from '@/components/auth/google-one-tap'
import { MessagingProvider } from '@/components/messaging/messaging-provider'
import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'
import config from '@/config/config'

export function Providers({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  const googleClientId = config.google.oauthClientId

  const tree = (
    <HeroUIProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        storageKey="wc-booking-theme"
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
              <AuthModal />
              {googleClientId ? <GoogleOneTap /> : null}
            </WebSocketProvider>
          </AuthProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </HeroUIProvider>
  )

  // Only mount GoogleOAuthProvider when a client ID is configured, so environments
  // without Google auth still render email auth without GSI script errors.
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  )
}
