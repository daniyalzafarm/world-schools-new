'use client'

import { ArticleForm } from '@/components/kb/article-form'
import { useKbArticlesStore } from '@/stores/kb-articles-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { CreateArticleData } from '@world-schools/wc-frontend-utils'

export default function EditArticlePage() {
  const router = useRouter()
  const params = useParams()
  const articleId = params.id as string
  const { hasPermission } = usePermissions()
  const { currentArticle, getArticleById, updateArticle, isLoading } = useKbArticlesStore()
  const canUpdate = hasPermission('kb.articles.update')
  const requestedArticleRef = useRef<string | null>(null)

  // Check permission
  useEffect(() => {
    if (!canUpdate) {
      router.push('/kb/articles')
    }
  }, [canUpdate, router])

  // Fetch article on mount
  useEffect(() => {
    if (!canUpdate || !articleId) return
    if (requestedArticleRef.current === articleId) return

    requestedArticleRef.current = articleId
    void getArticleById(articleId).catch(() => {
      // Allow retry if request fails
      requestedArticleRef.current = null
    })
  }, [articleId, canUpdate, getArticleById])

  useEffect(() => {
    if (currentArticle?.id === articleId) {
      requestedArticleRef.current = articleId
    }
  }, [articleId, currentArticle?.id])

  const handleSubmit = async (data: CreateArticleData) => {
    // Convert CreateArticleData to UpdateArticleData (all fields are optional in update)
    return await updateArticle(articleId, data)
  }

  if (!canUpdate) {
    return null
  }

  // Only show the form when the loaded article matches the requested id (avoids showing
  // previous article when navigating from one edit page to another before fetch completes)
  const articleMatchesRoute = currentArticle?.id === articleId

  if (isLoading && !currentArticle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading article...</p>
        </div>
      </div>
    )
  }

  if (isLoading && !articleMatchesRoute) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading article...</p>
        </div>
      </div>
    )
  }

  if (!currentArticle || !articleMatchesRoute) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Article Not Found</h1>
          <p className="text-default-500">
            The article you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  return <ArticleForm article={currentArticle} onSubmit={handleSubmit} isLoading={isLoading} />
}
