'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'
import { ConfirmDialogProvider } from '@world-schools/ui-web'

import { AuthProvider } from '@/components/auth/auth-provider'

export function Providers({ children }: { children: React.ReactNode }) {
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
          <AuthProvider>{children}</AuthProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </HeroUIProvider>
  )
}
