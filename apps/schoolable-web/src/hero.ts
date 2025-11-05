import { heroui } from '@heroui/react'

export default heroui({
  themes: {
    light: {
      colors: {
        // Primary colors (blue-gray)
        primary: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ceff',
          300: '#8db6ff',
          400: '#669eff',
          500: '#357BFF', // main brand color
          600: '#2e6de6',
          700: '#265bcc',
          800: '#1f4ab3',
          900: '#183a99',
          DEFAULT: '#357BFF',
        },
        // Secondary colors (based on #565A5E)
        secondary: {
          50: '#f7f7f8',
          100: '#eceeef',
          200: '#d9dde0',
          300: '#c1c6cb',
          400: '#a5acb3',
          500: '#565A5E',
          600: '#4b4f53',
          700: '#3f4347',
          800: '#34383c',
          900: '#292d31',
          DEFAULT: '#565A5E',
        },
      },
    },
    dark: {
      colors: {
        // Primary colors (blue-gray) - lighter versions for dark mode accents
        primary: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ceff',
          300: '#8db6ff',
          400: '#669eff',
          500: '#357BFF', // brand color
          600: '#2e6de6',
          700: '#265bcc',
          800: '#1f4ab3',
          900: '#183a99',
          DEFAULT: '#357BFF',
        },
        // Secondary colors (based on #565A5E)
        secondary: {
          50: '#f7f7f8',
          100: '#eceeef',
          200: '#d9dde0',
          300: '#c1c6cb',
          400: '#a5acb3',
          500: '#565A5E',
          600: '#4b4f53',
          700: '#3f4347',
          800: '#34383c',
          900: '#292d31',
          DEFAULT: '#565A5E',
        },
      },
    },
  },
})
