'use client'

import React from 'react'

interface AuthFormShellProps {
  /** Centered heading, pinned in the header row alongside the modal's close button. */
  title?: string
  /** Pinned sub-heading under the title. */
  description?: React.ReactNode
  /** Scrollable content: fields (and, for view-only states, the whole body). */
  children: React.ReactNode
  /** Pinned action area: primary button + secondary links. Omit for view-only states. */
  footer?: React.ReactNode
  /** When provided, wraps header + body + footer in a <form> so a footer submit button works. */
  onSubmit?: (event: React.FormEvent) => void
}

/**
 * Shared layout for auth forms. The header (title/description) and footer (actions) stay
 * pinned; only the body scrolls.
 * - In the modal, the parent (ModalContent) is height-constrained, so the body scrolls
 *   internally while the title and actions remain visible. The title is centered across the
 *   full width so it stays centered regardless of the floating back/close buttons.
 * - On the full-page auth routes the parent is unconstrained, so nothing scrolls internally
 *   and the page scrolls as before.
 */
export function AuthFormShell({
  title,
  description,
  children,
  footer,
  onSubmit,
}: AuthFormShellProps) {
  const body = (
    <>
      {title ? (
        <div className="shrink-0 space-y-2 px-6 pt-5 pb-4">
          {/* px-8 keeps the centered title clear of the corner back/close buttons */}
          <h1 className="px-8 text-center text-2xl font-bold text-secondary-500">{title}</h1>
          {description ? <p className="text-center text-sm text-gray-500">{description}</p> : null}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2 space-y-5">{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 space-y-3">{footer}</div>
      ) : null}
    </>
  )

  const className = 'flex min-h-0 flex-1 flex-col'

  return onSubmit ? (
    <form onSubmit={onSubmit} className={className}>
      {body}
    </form>
  ) : (
    <div className={className}>{body}</div>
  )
}
