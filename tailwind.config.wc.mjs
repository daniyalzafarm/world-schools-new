/**
 * Shared Tailwind CSS configuration for World Camps (wc-*) applications
 *
 * This configuration is used by:
 * - apps/wc-provider
 * - apps/wc-superadmin
 * - apps/wc-booking (can optionally extend this)
 *
 * To use this config in a wc app:
 * ```javascript
 * import { createWcTailwindConfig } from '../../tailwind.config.wc.mjs'
 * export default createWcTailwindConfig()
 * ```
 *
 * To add app-specific customizations:
 * ```javascript
 * import { createWcTailwindConfig } from '../../tailwind.config.wc.mjs'
 * const config = createWcTailwindConfig()
 * config.theme.extend.colors.custom = { ... }
 * export default config
 * ```
 *
 * IMPORTANT: Tailwind CSS v4 @source directive for shared packages
 * ================================================================
 * When using shared UI components from packages/ui-web, you MUST add
 * the @source directive to your app's globals.css file to scan the
 * shared package directory. Example:
 *
 *   @source '../../../../packages/ui-web/src/**\/*.{js,ts,jsx,tsx}';
 *
 * This tells Tailwind v4 to scan the shared package for utility classes.
 * Without this, Tailwind classes from shared components will not be generated.
 *
 * See: https://tailwindcss.com/docs/detecting-classes-in-source-files#explicitly-registering-sources
 */

import { heroui } from '@heroui/react'

/**
 * World Camps brand colors
 * These colors are shared across all wc-* applications
 */
export const wcColors = {
  primary: {
    50: '#dcfeee',
    100: '#b3fddc',
    200: '#45f0b5',
    300: '#22c192',
    500: '#45f0b5',
    600: '#22c192',
    700: '#1a9a75',
    800: '#137358',
    900: '#0d4d3b',
    DEFAULT: '#45f0b5',
  },
  secondary: {
    50: '#e8eaf0',
    100: '#d1d5e1',
    200: '#a3abc3',
    300: '#7581a5',
    400: '#475787',
    500: '#07153d',
    600: '#061134',
    700: '#050d2b',
    800: '#040922',
    900: '#020519',
    DEFAULT: '#07153d',
  },
  success: {
    50: '#d1f4e0',
    100: '#a3e9c1',
    200: '#75dea2',
    300: '#47d383',
    400: '#35a866',
    500: '#23874e',
    600: '#1c6c3e',
    700: '#15512f',
    800: '#0e361f',
    900: '#071b10',
    DEFAULT: '#23874e',
  },
  warning: {
    50: '#fdedd3',
    100: '#fbdba7',
    200: '#f9c97b',
    300: '#f7b74f',
    400: '#c48f32',
    500: '#936316',
    600: '#764f12',
    700: '#593b0d',
    800: '#3c2809',
    900: '#1f1404',
    DEFAULT: '#936316',
  },
  error: {
    50: '#fdd0df',
    100: '#fba1bf',
    200: '#f9729f',
    300: '#f7437f',
    400: '#dc1165',
    500: '#c20e4d',
    600: '#9b0b3e',
    700: '#74082e',
    800: '#4d051f',
    900: '#26030f',
    DEFAULT: '#c20e4d',
  },
}

/**
 * Creates a complete Tailwind CSS configuration for a World Camps application
 * @param {Object} options - Configuration options
 * @param {string[]} options.additionalContent - Additional content paths to scan for Tailwind classes
 * @param {Object} options.extendTheme - Additional theme extensions
 * @param {Object[]} options.additionalPlugins - Additional Tailwind plugins
 * @returns {Object} Tailwind CSS configuration object
 */
export function createWcTailwindConfig(options = {}) {
  const { additionalContent = [], extendTheme = {}, additionalPlugins = [] } = options

  return {
    content: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
      './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
      ...additionalContent,
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        },
        colors: wcColors,
        ...extendTheme,
      },
    },
    darkMode: 'class',
    plugins: [
      heroui({
        themes: {
          light: {
            fonts: {
              sans: 'var(--font-figtree)',
            },
            colors: {
              primary: {
                ...wcColors.primary,
                foreground: wcColors.secondary.DEFAULT,
              },
              secondary: {
                ...wcColors.secondary,
                foreground: '#ffffff',
              },
              success: {
                ...wcColors.success,
                foreground: '#ffffff',
              },
              warning: {
                ...wcColors.warning,
                foreground: '#ffffff',
              },
              danger: {
                ...wcColors.error,
                foreground: '#ffffff',
              },
            },
          },
          dark: {
            fonts: {
              sans: 'var(--font-figtree)',
            },
            colors: {
              primary: {
                ...wcColors.primary,
                foreground: '#000000',
              },
              secondary: {
                ...wcColors.secondary,
                foreground: '#ffffff',
              },
              success: {
                ...wcColors.success,
                foreground: '#ffffff',
              },
              warning: {
                ...wcColors.warning,
                foreground: '#ffffff',
              },
              danger: {
                ...wcColors.error,
                foreground: '#ffffff',
              },
            },
          },
        },
      }),
      ...additionalPlugins,
    ],
  }
}


