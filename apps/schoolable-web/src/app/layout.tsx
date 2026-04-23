import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'
import 'react-image-gallery/styles/css/image-gallery.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://schoolable.worldschools.com'),
  title: 'Schoolable Web',
  description: 'Schoolable AI platform built with Next.js and HeroUI',
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
