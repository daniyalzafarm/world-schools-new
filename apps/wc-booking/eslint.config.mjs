/**
 * ESLint configuration for wc-booking Next.js application
 *
 * This configuration uses the shared Next.js config from the root directory.
 * To add app-specific overrides, add them to the config array before exporting.
 */

import { createNextJsConfig } from '../../eslint.config.nextjs.mjs'

// Create the base Next.js configuration
const config = createNextJsConfig(import.meta.url)

// Add app-specific overrides here if needed
// Example:
// config.push({
//   files: ['**/*.ts', '**/*.tsx'],
//   rules: {
//     // Your app-specific rules here
//   }
// })

export default config
