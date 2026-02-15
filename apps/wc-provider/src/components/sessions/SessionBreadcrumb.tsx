'use client'

interface SessionBreadcrumbProps {
  title: string
  subtitle?: string
}

/**
 * Session Breadcrumb Component
 * Displays page title and subtitle for session forms
 * Note: Back button has been moved to SessionFormFooter
 */
export function SessionBreadcrumb({ title, subtitle }: SessionBreadcrumbProps) {
  return (
    <div className="mb-2">
      {/* Page Title */}
      <div>
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-base leading-normal text-default-500">{subtitle}</p>}
      </div>
    </div>
  )
}
