import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how World Camps collects, uses, and protects your personal information. Our privacy policy explains your rights under GDPR and other privacy regulations.',
  keywords: [
    'privacy policy',
    'data protection',
    'GDPR',
    'personal information',
    'data privacy',
    'World Camps privacy',
  ],
  openGraph: {
    title: 'Privacy Policy | World Camps',
    description: 'Learn how World Camps collects, uses, and protects your personal information.',
    type: 'website',
  },
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
