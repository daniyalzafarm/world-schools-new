import { AppProviders } from '../providers'

/**
 * Authenticated application shell. Wraps every non-public route in the auth /
 * realtime providers and forces dynamic rendering (the app reads per-request
 * runtime config and auth state). Public, SEO-facing routes live under
 * `(public)` and deliberately skip this layout.
 */
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
