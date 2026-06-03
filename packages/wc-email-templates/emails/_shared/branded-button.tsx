import { Button, Section } from '@react-email/components'
import { theme } from './theme'

export interface BrandedButtonProps {
  href: string
  children: string
}

export function BrandedButton({ href, children }: BrandedButtonProps) {
  return (
    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={href} style={buttonStyle}>
        {children}
      </Button>
    </Section>
  )
}

const buttonStyle = {
  backgroundColor: theme.colors.primary,
  color: theme.colors.secondary,
  fontSize: '16px',
  fontWeight: 600,
  padding: '14px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
