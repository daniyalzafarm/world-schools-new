/**
 * Next.js configuration for wc-booking
 *
 * We can now reuse the shared World Camps config without inheriting the
 * dashboard redirect because createWcNextConfig no longer adds it by default.
 */

import type { NextConfig } from 'next'
import { createWcNextConfig } from '../../next.config.wc.mjs'

const nextConfig: NextConfig = createWcNextConfig({
  // Expose booking-specific environment variables
  envVars: {
    BOOKING_CUSTOM_KEY: process.env.BOOKING_CUSTOM_KEY,
  },
})

export default nextConfig
