import type { ReactNode } from 'react'

interface SupportTicketLayoutProps {
  breadcrumb: ReactNode
  title: ReactNode
  actions?: ReactNode
  rightSidebar?: ReactNode
  children: ReactNode
}

/**
 * Layout shell for support ticket detail pages.
 * Mirrors the KB editor pattern: sticky top bar + main content + right sidebar.
 */
export function SupportTicketLayout({
  breadcrumb,
  title,
  actions,
  rightSidebar,
  children,
}: SupportTicketLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-20 border-b border-default-200 p-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div>{breadcrumb}</div>
            <div>{title}</div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main content (conversation) */}
        <div className="min-w-0 flex-1">{children}</div>

        {/* Right sidebar on large screens */}
        {rightSidebar && (
          <aside className="hidden h-full w-96 shrink-0 overflow-y-auto border-l border-default-200 bg-background lg:block">
            {rightSidebar}
          </aside>
        )}
      </div>
    </div>
  )
}
