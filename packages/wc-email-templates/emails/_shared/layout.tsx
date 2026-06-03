import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'
import { theme } from './theme'

export interface LayoutProps {
  /** Short preview line shown in inbox previews (Gmail/Outlook collapsed view). */
  preview: string
  /** Optional logo override; defaults to the World Camps wordmark. */
  logoUrl?: string
  children: ReactNode
}

/**
 * Shared layout for all World Camps notification emails.
 *
 * Provides: branded header, container with max width, body padding,
 * footer with company/support links. Children render between header
 * and footer.
 */
export function Layout({ preview, logoUrl, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            {logoUrl ? (
              <Img src={logoUrl} alt="World Camps" height="32" />
            ) : (
              <Text style={brandStyle}>World Camps</Text>
            )}
          </Section>
          <Section style={contentStyle}>{children}</Section>
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              World Camps · International educational programs trusted by families worldwide.
            </Text>
            <Text style={footerTextStyle}>
              Questions? Just reply to this email — we&apos;re always happy to help.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle = {
  backgroundColor: theme.colors.backgroundGray,
  fontFamily: theme.fonts.base,
  margin: 0,
  padding: 0,
}

const containerStyle = {
  backgroundColor: theme.colors.background,
  margin: '0 auto',
  maxWidth: theme.spacing.container,
  padding: 0,
}

const headerStyle = {
  background: `linear-gradient(135deg, ${theme.colors.secondary} 0%, ${theme.colors.primaryDark} 100%)`,
  color: theme.colors.background,
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const brandStyle = {
  color: theme.colors.background,
  fontSize: '24px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  margin: 0,
}

const contentStyle = {
  color: theme.colors.textPrimary,
  padding: `${theme.spacing.contentY} ${theme.spacing.contentX}`,
}

const hrStyle = {
  borderColor: theme.colors.border,
  margin: '0',
}

const footerStyle = {
  backgroundColor: theme.colors.backgroundGray,
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const footerTextStyle = {
  color: theme.colors.textSecondary,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '4px 0',
}
