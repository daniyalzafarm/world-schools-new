'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ConfirmDialogProvider } from '@world-schools/ui-web'
import { WebSocketProvider } from '@world-schools/wc-frontend-utils'

import { AuthProvider } from '@/components/auth/auth-provider'
import { AuthModal } from '@/components/auth/auth-modal'
import { GoogleOneTap } from '@/components/auth/google-one-tap'
import {
  IncompleteBookingBanner,
  useIncompleteBookingVisible,
} from '@/components/layout/incomplete-booking-banner'
import { MessagingProvider } from '@/components/messaging/messaging-provider'
import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'
import config from '@/config/config'

/**
 * UI / theme providers shared by ALL routes (public + authenticated).
 * These are SSR-safe and non-blocking, so they can wrap server-rendered
 * public pages (e.g. the camp profile) without hiding content from crawlers.
 *
 * AuthModal and GoogleOneTap live here (not in AppProviders) because public
 * camp pages trigger the auth modal / Google sign-in; both are store-driven
 * and render nothing until needed.
 */
export function RootProviders({ children }: { children: React.ReactNode }) {
  const googleClientId = config.google.oauthClientId
  // Push toasts below the fixed "Incomplete booking" banner when it's showing,
  // so they don't render behind it.
  const bannerVisible = useIncompleteBookingVisible()

  const tree = (
    <HeroUIProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        storageKey="wc-booking-theme"
      >
        <ToastProvider placement="top-right" toastOffset={bannerVisible ? 60 : 10} />
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        <AuthModal />
        {googleClientId ? <GoogleOneTap /> : null}
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
        <IncompleteBookingBanner />
      </WebSocketProvider>
    </AuthProvider>
  )
}
