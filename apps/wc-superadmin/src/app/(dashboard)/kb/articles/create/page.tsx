'use client'

import { addToast } from '@heroui/react'
import { ArticleForm } from '@/components/kb/article-form'
import { useKbArticlesStore } from '@/stores/kb-articles-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { CreateArticleData } from '@world-schools/wc-frontend-utils'

export default function CreateArticlePage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { createArticle, isLoading } = useKbArticlesStore()
  const canCreate = hasPermission('kb.articles.create')

  // Check permission
  useEffect(() => {
    if (!canCreate) {
      router.push('/kb/articles')
    }
  }, [canCreate, router])

  const handleSubmit = async (data: CreateArticleData) => {
    const success = await createArticle(data)
    if (success) {
      addToast({
        title: 'Success',
        description: 'Article created successfully',
        color: 'success',
        timeout: 3000,
      })
    }
    return success
  }

  if (!canCreate) {
    return null
  }

  return <ArticleForm onSubmit={handleSubmit} isLoading={isLoading} />
}
