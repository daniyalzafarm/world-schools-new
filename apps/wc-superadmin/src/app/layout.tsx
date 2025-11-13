import type { Metadata } from 'next'

import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'World Camps Superadmin',
  description: 'Administrative portal for managing World Camps providers and users',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
