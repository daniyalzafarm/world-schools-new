/**
 * Next.js configuration for wc-provider
 *
 * This configuration uses the shared World Camps config from the root directory.
 * To add app-specific customizations, modify the config object before exporting.
 */

import type { NextConfig } from 'next'
import { createWcNextConfig } from '../../next.config.wc.mjs'

// Create the base World Camps Next.js configuration
const nextConfig: NextConfig = createWcNextConfig({
  redirectTo: '/dashboard',
})

// Add app-specific customizations here if needed
// Example:
// nextConfig.experimental.someFeature = true

export default nextConfig
