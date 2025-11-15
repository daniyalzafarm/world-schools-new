/**
 * Shared ESLint configuration for all NestJS applications
 *
 * This configuration is used by:
 * - apps/wc-nest-api
 * - apps/schoolable-nest-api
 *
 * To use this config in a NestJS app:
 * ```javascript
 * import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'
 * export default createNestJsConfig(import.meta.url)
 * ```
 *
 * To add app-specific overrides:
 * ```javascript
 * import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'
 * const config = createNestJsConfig(import.meta.url)
 * config.push({
 *   rules: {
 *     // Your app-specific rules here
 *   }
 * })
 * export default config
 * ```
 */

import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import globals from 'globals'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

/**
 * Creates a complete ESLint configuration for a NestJS application
 * @param {string} importMetaUrl - Pass `import.meta.url` from the app's eslint.config.mjs
 * @returns {Array} ESLint flat config array
 */
export function createNestJsConfig(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl)
  const __dirname = dirname(__filename)

  const typescriptConfig = {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: [resolve(__dirname, 'tsconfig.json')],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2020,
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // ============================================
      // TypeScript Rules
      // ============================================
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: true,
          ignoreMixedLogicalExpressions: true,
          ignorePrimitives: {
            string: true,
            number: false,
            bigint: false,
            boolean: false,
          },
        },
      ],
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'error',

      // ============================================
      // NestJS-Specific Rules
      // ============================================
      // NestJS uses decorators extensively - ensure they're allowed
      '@typescript-eslint/no-extraneous-class': 'off',
      // NestJS uses parameter decorators which can appear unused
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          // Allow unused parameters in constructors (dependency injection)
          args: 'after-used',
        },
      ],
      // NestJS uses empty constructors for dependency injection
      '@typescript-eslint/no-useless-constructor': 'off',
      // NestJS uses classes as interfaces (DTOs)
      '@typescript-eslint/no-empty-interface': 'off',

      // ============================================
      // General JavaScript/TypeScript Rules
      // ============================================
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',

      // ============================================
      // Import/Export Rules
      // ============================================
      'no-duplicate-imports': 'error',
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],

      // ============================================
      // String Consistency
      // ============================================
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      // ============================================
      // Async/Promise Rules (Important for NestJS)
      // ============================================
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
    },
  }

  const config = [
    // Base JavaScript recommendations
    js.configs.recommended,

    // Global ignores
    {
      ignores: [
        'dist/**',
        'build/**',
        'node_modules/**',
        'coverage/**',
        '*.min.js',
        'webpack.config.js',
        'prisma/migrations/**',
      ],
    },

    // Configuration for ESLint config file
    {
      files: ['eslint.config.mjs'],
      languageOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      rules: {
        'no-unused-vars': 'warn',
        'prefer-const': 'error',
      },
    },

    // Configuration for all TypeScript files
    typescriptConfig,

    // Configuration for test files
    {
      files: ['**/*.{test,spec}.ts', '**/__tests__/**/*.ts', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
      },
    },

    // Configuration for configuration files
    {
      files: ['*.config.{js,ts,mjs}', 'prisma/seed.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },

    // Prettier integration - must be last to override conflicting rules
    eslintPluginPrettierRecommended,
  ]

  return config
}
