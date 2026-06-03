export const theme = {
  colors: {
    primary: '#45f0b5',
    primaryDark: '#22c192',
    secondary: '#07153d',
    success: '#23874e',
    warning: '#936316',
    danger: '#c20e4d',
    background: '#ffffff',
    backgroundGray: '#f9f9f9',
    textPrimary: '#07153d',
    textSecondary: '#666666',
    border: '#e5e5e5',
  },
  fonts: {
    base: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  spacing: {
    container: '600px',
    contentX: '32px',
    contentY: '40px',
  },
} as const

export type Theme = typeof theme
