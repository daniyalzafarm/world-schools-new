/**
 * Shared PostCSS configuration for World Camps (wc-*) applications
 *
 * This configuration is used by:
 * - apps/wc-provider
 * - apps/wc-superadmin
 * - apps/wc-booking (can optionally use this)
 *
 * This config uses the new Tailwind CSS v4 PostCSS plugin.
 */

const config = {
  plugins: ['@tailwindcss/postcss'],
}

export default config

