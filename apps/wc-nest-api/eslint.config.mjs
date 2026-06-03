/**
 * ESLint configuration for wc-nest-api NestJS application
 *
 * This configuration uses the shared NestJS config from the root directory.
 * To add app-specific overrides, add them to the config array before exporting.
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'

// Create the base NestJS configuration
const config = createNestJsConfig(import.meta.url)

// scripts/ runs via tsx (ESM-aware) and uses `import.meta`, so it needs its
// own tsconfig with `module: esnext`. The app's tsconfig.app.json stays on
// CommonJS for the webpack build. Point @typescript-eslint at the scripts
// tsconfig only for files under scripts/.
const __dirname = dirname(fileURLToPath(import.meta.url))
config.push({
  files: ['scripts/**/*.ts'],
  languageOptions: {
    parserOptions: {
      project: resolve(__dirname, 'tsconfig.scripts.json'),
      tsconfigRootDir: __dirname,
    },
  },
})

export default config
