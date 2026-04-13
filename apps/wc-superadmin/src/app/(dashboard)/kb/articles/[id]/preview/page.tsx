'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Pencil } from 'lucide-react'
import { BreadcrumbItem, Breadcrumbs, Button, Chip } from '@heroui/react'
import { useConfirmDialog } from '@world-schools/ui-web'
import { ArticleEditorTopBar } from '@/components/kb/ArticleEditorTopBar'
import { usePermissions } from '@/hooks/use-permissions'
import { getArticle, getRelatedArticles } from '@/services/kb-articles.service'
import { useKbArticlesStore } from '@/stores/kb-articles-store'
import {
  type Article,
  type ArticleStatus,
  articleTypeLabel,
  HelpContactCta,
  type RelatedArticle,
} from '@world-schools/wc-frontend-utils'

function getStatusProps(status: ArticleStatus): {
  color: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  label: string
} {
  if (status === 'published') return { color: 'success', label: 'Published' }
  if (status === 'archived') return { color: 'warning', label: 'Archived' }
  return { color: 'default', label: 'Draft' }
}

export default function KbArticlePreviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params['id'] as string
  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()
  const { publishArticle, unpublishArticle } = useKbArticlesStore()
  const [article, setArticle] = useState<Article | null>(null)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const canPublish = hasPermission('kb.articles.publish')

  const refetchArticle = useCallback(() => {
    void getArticle(id).then(res => {
      if (res.success && res.data) setArticle(res.data)
    })
  }, [id])

  const handleTogglePublish = useCallback(async () => {
    if (!article) return
    const isPublished = article.status === 'published'
    const action = isPublished ? 'unpublish' : 'publish'
    const confirmed = await confirm({
      title: isPublished ? 'Unpublish Article' : 'Publish Article',
      message: `Are you sure you want to ${action} "${article.title}"?`,
      confirmText: isPublished ? 'Unpublish' : 'Publish',
      cancelText: 'Cancel',
      variant: isPublished ? 'danger' : 'info',
    })
    if (confirmed) {
      const success = isPublished
        ? await unpublishArticle(article.id)
        : await publishArticle(article.id)
      if (success) refetchArticle()
    }
  }, [article, confirm, publishArticle, unpublishArticle, refetchArticle])

  useEffect(() => {
    getArticle(id)
      .then(res => {
        if (!res.success || !res.data) {
          setNotFound(true)
          return
        }
        setArticle(res.data)
        return getRelatedArticles(id)
      })
      .then(relatedRes => {
        if (relatedRes?.success && relatedRes.data) {
          setRelated(relatedRes.data)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <ArticleEditorTopBar
          title="Preview"
          breadcrumb="Knowledge Base"
          status={undefined}
          actions={
            <Button
              size="sm"
              variant="flat"
              startContent={<Pencil className="h-4 w-4" />}
              onPress={() => router.push(`/kb/articles/${id}/edit`)}
            >
              Edit
            </Button>
          }
          previewMode
        />
        <div className="mx-auto max-w-3xl px-5 py-8">
          <div className="mb-8 h-5 w-64 animate-pulse rounded bg-gray-50" />
          <div className="h-8 w-full animate-pulse rounded bg-gray-50" />
        </div>
      </div>
    )
  }

  if (notFound || !article) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <ArticleEditorTopBar title="Preview" breadcrumb="Knowledge Base" previewMode />
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <p className="text-gray-500">Article not found.</p>
          <Link href="/kb/articles" className="mt-4 inline-block text-primary underline">
            Back to Articles
          </Link>
        </div>
      </div>
    )
  }

  const typeInfo = articleTypeLabel(article.articleType)
  const category = article.category

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ArticleEditorTopBar
        title={article.title}
        breadcrumb="Knowledge Base"
        actions={
          <div className="flex items-center gap-2">
            <Chip className="mr-2" color={getStatusProps(article.status).color} variant="flat">
              {getStatusProps(article.status).label}
            </Chip>
            {canPublish && (
              <Button
                color={article.status === 'published' ? 'danger' : 'primary'}
                onPress={() => void handleTogglePublish()}
              >
                {article.status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
            )}
            <Button
              color="secondary"
              startContent={<Pencil className="h-4 w-4" />}
              onPress={() => router.push(`/kb/articles/${id}/edit`)}
            >
              Edit
            </Button>
            <Button variant="bordered" onPress={() => router.back()}>
              Close Preview
            </Button>
          </div>
        }
        previewMode
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <main className="mx-auto max-w-3xl px-5 py-8 pb-20">
          <nav className="max-w-3xl pb-6" aria-label="Breadcrumb">
            <Breadcrumbs variant="light" color="foreground">
              <BreadcrumbItem>Help Center</BreadcrumbItem>
              {category && <BreadcrumbItem>{category.name}</BreadcrumbItem>}
              <BreadcrumbItem>{article.title}</BreadcrumbItem>
            </Breadcrumbs>
          </nav>
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {typeInfo.label}
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-secondary md:text-3xl">
              {article.title}
            </h1>
            {article.summary && (
              <p className="mt-2 text-gray-500 leading-relaxed">{article.summary}</p>
            )}
          </div>

          <div dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

          <div className="mt-12 border-t border-gray-200 pt-8 text-center">
            <p className="mb-4 text-base font-semibold text-secondary">Did this article help?</p>
            <div className="flex justify-center gap-3">
              <Button variant="bordered" color="default" onPress={() => {}}>
                Yes
              </Button>
              <Button variant="bordered" color="default" onPress={() => {}}>
                No
              </Button>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <h3 className="mb-4 text-lg font-semibold text-secondary">Related articles</h3>
              <ul className="flex flex-col gap-3">
                {related.map(r => (
                  <li key={r.id}>
                    <Link
                      href={`/kb/articles/${r.id}/preview`}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 p-4 text-secondary no-underline transition-colors hover:bg-gray-100"
                    >
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" strokeWidth={2} />
                      <span>{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-12">
            <HelpContactCta previewMode />
          </div>
        </main>
      </div>
    </div>
  )
}
