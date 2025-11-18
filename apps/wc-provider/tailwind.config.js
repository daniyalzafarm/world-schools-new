/**
 * Tailwind CSS configuration for wc-provider
 *
 * This configuration uses the shared World Camps config from the root directory.
 * To add app-specific customizations, modify the config object before exporting.
 */

import { createWcTailwindConfig } from '../../tailwind.config.wc.mjs'

// Create the base World Camps Tailwind configuration
const config = createWcTailwindConfig()

// Add app-specific customizations here if needed
// Example:
// config.theme.extend.colors.custom = { ... }
// config.content.push('./additional-path/**/*.{js,ts,jsx,tsx}')

export default config
