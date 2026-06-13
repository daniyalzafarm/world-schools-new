/**
 * Public, SEO-facing shell. Inherits the SSR-safe UI providers (HeroUI/theme)
 * from the root layout but deliberately omits the blocking auth/realtime
 * providers, so pages here server-render real content for crawlers. ISR-cached.
 */
export const revalidate = 3600

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
