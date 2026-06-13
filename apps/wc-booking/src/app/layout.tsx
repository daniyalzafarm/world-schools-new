import type { Metadata, Viewport } from 'next'

import config from '@/config/config'
import { getServerConfig, serializeConfigForScript } from '@/config/runtime-config'

import { RootProviders } from './providers'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(config.app.metadataBase),
  title: {
    default: 'World Camps - Discover Amazing Camp Experiences',
    template: '%s | World Camps',
  },
  description:
    'Discover and book amazing camp experiences for your children. Browse camps, manage bookings, and create unforgettable memories with World Camps.',
  keywords: [
    'camps',
    'summer camps',
    'children activities',
    'camp booking',
    'kids camps',
    'world camps',
  ],
  authors: [{ name: 'World Camps' }],
  creator: 'World Camps',
  publisher: 'World Camps',
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: config.app.metadataBase,
    siteName: 'World Camps',
    title: 'World Camps - Discover Amazing Camp Experiences',
    description:
      'Discover and book amazing camp experiences for your children. Browse camps, manage bookings, and create unforgettable memories.',
    images: [
      {
        url: '/assets/world-camps-icon.png',
        width: 1200,
        height: 630,
        alt: 'World Camps',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Camps - Discover Amazing Camp Experiences',
    description:
      'Discover and book amazing camp experiences for your children. Browse camps, manage bookings, and create unforgettable memories.',
    images: ['/assets/world-camps-icon.png'],
    creator: '@worldcamps',
  },
  icons: {
    icon: [
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/favicon.ico',
    apple: {
      url: '/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#45f0b5',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const runtimeConfigScript = `window.__APP_CONFIG__=${serializeConfigForScript(getServerConfig())};`
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  )
}
