import { Section } from '@react-email/components'
import type { ReactNode } from 'react'
import { theme } from './theme'

export interface InfoPanelProps {
  children: ReactNode
  /** Optional accent color override (defaults to brand primary). */
  accent?: string
}

/**
 * Light grey panel with a left accent bar — used to highlight booking
 * details, payment summaries, schedules, etc.
 */
export function InfoPanel({ children, accent }: InfoPanelProps) {
  return (
    <Section
      style={{
        backgroundColor: theme.colors.backgroundGray,
        borderLeft: `4px solid ${accent ?? theme.colors.primary}`,
        padding: '20px 24px',
        margin: '24px 0',
        borderRadius: '4px',
      }}
    >
      {children}
    </Section>
  )
}
