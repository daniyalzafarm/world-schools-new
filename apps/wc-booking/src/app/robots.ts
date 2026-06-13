import type { MetadataRoute } from 'next'

import config from '@/config/config'

/**
 * Only the public camp profile pages should be indexed. Everything else in this
 * app is the authenticated experience.
 *
 * Note: under the Pagely reverse-proxy, `world-camps.org/robots.txt` falls back
 * to WordPress (root paths aren't proxied to React). To expose this file at the
 * public domain, either proxy `/robots.txt` to the app or have WordPress'
 * robots.txt reference the camp sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = config.app.metadataBase.replace(/\/+$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/camp/',
      disallow: [
        '/account',
        '/messages',
        '/bookings',
        '/book',
        '/payment',
        '/auth',
        '/api',
        '/camps',
        '/wishlists',
        '/reviews',
        '/notifications',
        '/support',
        '/help',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
