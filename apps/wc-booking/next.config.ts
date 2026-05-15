/**
 * Next.js configuration for wc-booking
 *
 * We can now reuse the shared World Camps config without inheriting the
 * dashboard redirect because createWcNextConfig no longer adds it by default.
 */

import type { NextConfig } from 'next'
import { createWcNextConfig } from '../../next.config.wc.mjs'

const nextConfig: NextConfig = createWcNextConfig({})

export default nextConfig
