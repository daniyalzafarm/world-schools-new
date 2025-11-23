/**
 * Shared Next.js configuration for World Camps (wc-*) applications
 *
 * This configuration is used by:
 * - apps/wc-provider
 * - apps/wc-superadmin
 * - apps/wc-booking (can optionally use this)
 *
 * To use this config in a wc app:
 * ```javascript
 * import { createWcNextConfig } from '../../next.config.wc.mjs'
 * export default createWcNextConfig({
 *   // Only set redirectTo if you want "/" to point somewhere else
 *   redirectTo: '/dashboard',
 *   envVars: { PROVIDER_CUSTOM_KEY: process.env.PROVIDER_CUSTOM_KEY }
 * })
 * ```
 *
 * To add app-specific customizations:
 * ```javascript
 * import { createWcNextConfig } from '../../next.config.wc.mjs'
 * const config = createWcNextConfig()
 * config.experimental.someFeature = true
 * export default config
 * ```
 */

/**
 * Creates a complete Next.js configuration for a World Camps application
 * @param {Object} [options] - Configuration options
 * @param {string} [options.redirectTo] - Optional redirect destination from the root path.
 *                                       If omitted, "/" will render normally.
 * @param {Object} [options.envVars] - Environment variables to expose to the app
 * @param {Array} [options.additionalTranspilePackages] - Additional packages to transpile
 * @param {Array} [options.additionalImagePatterns] - Additional remote image patterns
 * @param {Function} [options.additionalHeaders] - Function returning additional headers
 * @param {Function} [options.additionalRedirects] - Function returning additional redirects
 * @param {Object} [options.additionalConfig] - Additional Next.js config options
 * @returns {Object} Next.js configuration object
 */
export function createWcNextConfig(options = {}) {
  const {
    redirectTo,
    envVars = {},
    additionalTranspilePackages = [],
    additionalImagePatterns = [],
    additionalHeaders = async () => [],
    additionalRedirects = async () => [],
    additionalConfig = {},
  } = options

  const config = {
    // Enable standalone output for Azure Static Web Apps deployment
    output: 'standalone',

    // Transpile shared World Camps packages
    transpilePackages: [
      '@world-schools/wc-utils',
      '@world-schools/wc-frontend-utils',
      '@world-schools/wc-types',
      '@world-schools/ui-web',
      ...additionalTranspilePackages,
    ],

    // Optimize package imports for better performance
    experimental: {
      optimizePackageImports: ['@heroui/react', '@heroicons/react'],
      ...additionalConfig.experimental,
    },

    // Configure remote image patterns
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'firebasestorage.googleapis.com',
          port: '',
          pathname: '/**',
        },
        {
          protocol: 'https',
          hostname: 'lh3.googleusercontent.com',
          port: '',
          pathname: '/**',
        },
        ...additionalImagePatterns,
      ],
      ...additionalConfig.images,
    },

    // Expose environment variables to the app
    env: envVars,

    // Security headers
    async headers() {
      const defaultHeaders = [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
          ],
        },
      ]

      const customHeaders = await additionalHeaders()
      return [...defaultHeaders, ...customHeaders]
    },

    // TypeScript configuration
    typescript: {
      ignoreBuildErrors: false,
      ...additionalConfig.typescript,
    },

    // Redirects
    async redirects() {
      const defaultRedirects = redirectTo
        ? [
            {
              source: '/',
              destination: redirectTo,
              permanent: true,
            },
          ]
        : []

      const customRedirects = await additionalRedirects()
      return [...defaultRedirects, ...customRedirects]
    },

    // Merge any additional config options
    ...additionalConfig,
  }

  return config
}

