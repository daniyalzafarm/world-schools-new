import { Text } from '@react-email/components'
import { theme } from './theme'

export type SalutationStyle = 'hi' | 'dear' | 'none'

export interface SalutationProps {
  style: SalutationStyle
  /** Recipient first name. When undefined / empty: parents fall back to
   *  "Hi there," per the spec; providers/superadmins render nothing. */
  firstName?: string | null
}

/**
 * Renders the opening salutation per the v28 spec conventions:
 * - parents (standard) → `Hi {firstName},` (or `Hi there,` when name missing)
 * - parents (formal: financial distress, disputes) → `Dear {firstName},`
 * - providers / superadmins → nothing (B2B / internal tooling)
 */
export function Salutation({ style, firstName }: SalutationProps) {
  if (style === 'none') return null
  const name = firstName?.trim() || null
  const greeting = style === 'dear' ? 'Dear' : 'Hi'
  const line = name ? `${greeting} ${name},` : style === 'hi' ? 'Hi there,' : 'Dear customer,'
  return <Text style={textStyle}>{line}</Text>
}

const textStyle = {
  color: theme.colors.textPrimary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
}
