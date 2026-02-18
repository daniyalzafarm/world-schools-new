/**
 * Shared ESLint configuration for all Next.js applications
 *
 * This configuration is used by:
 * - apps/wc-superadmin
 * - apps/schoolable-web
 * - apps/wc-booking
 * - apps/wc-provider
 *
 * To use this config in a Next.js app:
 * ```javascript
 * import { createNextJsConfig } from '../../eslint.config.nextjs.mjs'
 * export default createNextJsConfig(import.meta.url)
 * ```
 *
 * To add app-specific overrides:
 * ```javascript
 * import { createNextJsConfig } from '../../eslint.config.nextjs.mjs'
 * const config = createNextJsConfig(import.meta.url)
 * config.push({
 *   rules: {
 *     // Your app-specific rules here
 *   }
 * })
 * export default config
 * ```
 */

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

/**
 * Creates a complete ESLint configuration for a Next.js application
 * @param {string} importMetaUrl - Pass `import.meta.url` from the app's eslint.config.mjs
 * @returns {Array} ESLint flat config array
 */
export function createNextJsConfig(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl)
  const __dirname = dirname(__filename)

  const typescriptConfig = {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: [resolve(__dirname, 'tsconfig.json')],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        React: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/display-name': 'off',
      'react/jsx-key': [
        'error',
        {
          checkFragmentShorthand: true,
          checkKeyMustBeforeSpread: true,
        },
      ],

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',

      // Accessibility rules
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          components: ['Link'],
          specialLink: ['href'],
        },
      ],

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',

      // Import/Export rules
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

      // String consistency
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      'react/no-unescaped-entities': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
      linkComponents: [{ name: 'Link', linkAttribute: 'href' }],
    },
  }

  // Note: Not using compat.extends() for Next.js configs due to circular reference issues
  // Instead, we manually configure the necessary rules below
  const config = [
    // Base JavaScript recommendations
    js.configs.recommended,

    // Global ignores
    {
      ignores: [
        'dist/**',
        'build/**',
        '.next/**',
        'node_modules/**',
        'public/**',
        'coverage/**',
        '*.min.js',
        'next-env.d.ts',
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

    // Configuration for all TypeScript and JavaScript files
    typescriptConfig,

    // Specific configuration for TypeScript files
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
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
      },
    },

    // Configuration for test files
    {
      files: [
        '**/*.{test,spec}.{js,jsx,ts,tsx}',
        '**/__tests__/**/*.{js,jsx,ts,tsx}',
        '**/tests/**/*.{js,jsx,ts,tsx}',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        'react-hooks/rules-of-hooks': 'off',
      },
    },

    // Configuration for configuration files
    {
      files: ['next.config.ts', '*.config.{js,ts,mjs}'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-default-export': 'off',
      },
    },

    // Prettier integration - must be last to override conflicting rules
    eslintPluginPrettierRecommended,
  ]

  return config
}
