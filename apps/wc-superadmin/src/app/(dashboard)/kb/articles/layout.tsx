'use client'

import { type ReactNode, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@heroui/react'
import { Check } from 'lucide-react'
import { ArticleEditorTopBar } from '@/components/kb/ArticleEditorTopBar'
import {
  ArticleEditorLayoutProvider,
  useArticleEditorLayout,
} from '@/components/kb/ArticleEditorLayoutContext'

function isEditorRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.endsWith('/create') || pathname.endsWith('/edit')
}

function KbArticleLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const editorMode = useMemo(() => isEditorRoute(pathname), [pathname])
  const { rightSidebar, topBarConfig } = useArticleEditorLayout()
  const isEditRoute = pathname?.endsWith('/edit') ?? false
  const fallbackTitle = isEditRoute ? 'Edit Article' : 'Create Article'
  const resolvedTitle = topBarConfig.title === 'Article Editor' ? fallbackTitle : topBarConfig.title

  if (!editorMode) {
    return <>{children}</>
  }

  const fallbackActions = (
    <>
      <Button
        variant="flat"
        type="submit"
        form="article-editor-form"
        name="submitAction"
        value="draft"
      >
        Save Draft
      </Button>
      <Button
        color="primary"
        type="submit"
        form="article-editor-form"
        name="submitAction"
        value="published"
        startContent={<Check className="h-4 w-4" />}
      >
        Publish
      </Button>
    </>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-default-50">
      <div className="sticky top-0 z-20 shrink-0">
        <ArticleEditorTopBar
          title={resolvedTitle}
          breadcrumb={topBarConfig.breadcrumb}
          status={topBarConfig.status}
          actions={topBarConfig.actions ?? fallbackActions}
          onBackClick={topBarConfig.onBackClick}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="px-4 py-6 lg:px-10 lg:py-8">{children}</div>
        </div>

        <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-default-200 bg-background xl:block">
          {rightSidebar}
        </aside>
      </div>
    </div>
  )
}

export default function KbArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <ArticleEditorLayoutProvider>
      <KbArticleLayoutContent>{children}</KbArticleLayoutContent>
    </ArticleEditorLayoutProvider>
  )
}
