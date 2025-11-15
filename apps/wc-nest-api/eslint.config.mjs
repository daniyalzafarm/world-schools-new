/**
 * ESLint configuration for wc-nest-api NestJS application
 *
 * This configuration uses the shared NestJS config from the root directory.
 * To add app-specific overrides, add them to the config array before exporting.
 */

import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'

// Create the base NestJS configuration
const config = createNestJsConfig(import.meta.url)

// Add app-specific overrides here if needed
// Example:
// config.push({
//   files: ['**/*.ts'],
//   rules: {
//     // Your app-specific rules here
//   }
// })

export default config
