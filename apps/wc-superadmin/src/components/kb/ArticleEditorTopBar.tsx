'use client'

import { Chip, cn } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ArticleStatus } from '@world-schools/wc-frontend-utils'

interface ArticleEditorTopBarProps {
  title: string
  breadcrumb?: string
  status?: ArticleStatus
  actions?: ReactNode
  previewMode?: boolean
  onBackClick?: () => void
}

function getStatusProps(status: ArticleStatus): {
  color: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  label: string
} {
  if (status === 'published') return { color: 'success', label: 'Published' }
  if (status === 'archived') return { color: 'warning', label: 'Archived' }
  return { color: 'default', label: 'Draft' }
}

export function ArticleEditorTopBar({
  title,
  breadcrumb = 'Knowledge Base',
  status,
  actions,
  previewMode = false,
  onBackClick,
}: ArticleEditorTopBarProps) {
  const backClassName =
    'cursor-pointer inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground lg:text-sm'

  return (
    <header
      className={cn(
        'h-16 border-b-2 border-gray-200 bg-background px-5 lg:px-6',
        previewMode && 'border-warning-200'
      )}
    >
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3 lg:gap-4">
          {onBackClick ? (
            <button type="button" onClick={onBackClick} className={backClassName}>
              <ChevronLeft className="h-4 w-4" />
              {breadcrumb}
            </button>
          ) : (
            <Link href="/kb/articles" className={backClassName}>
              <ChevronLeft className="h-4 w-4" />
              {breadcrumb}
            </Link>
          )}

          <div className="hidden h-6 w-px bg-default-200 lg:block" />

          <div className="flex min-w-0 items-center gap-2">
            {previewMode && (
              <Chip color="warning" variant="flat">
                Preview Mode
              </Chip>
            )}
            <p className="truncate font-semibold text-foreground">{title}</p>
            {status && (
              <Chip color={getStatusProps(status).color} variant="flat" size="sm">
                {getStatusProps(status).label}
              </Chip>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  )
}
