'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { BreadcrumbItem, Breadcrumbs, Button } from '@heroui/react'
import type { KbArticle, KbArticleListItem } from '@world-schools/wc-types'
import { useHelpKb } from './help-kb-context'
import { articleTypeLabel } from './article-type-label'
import { HelpContactCta } from './help-contact-cta'
import { getOrCreateFeedbackSessionId } from './feedback-session'

export function HelpArticlePageContent() {
  const { service, basePath, supportHref } = useHelpKb()
  const params = useParams()
  const categorySlug = params['categorySlug'] as string
  const articleSlug = params['articleSlug'] as string
  const [article, setArticle] = useState<KbArticle | null>(null)
  const [related, setRelated] = useState<KbArticleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<'yes' | 'no' | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    service
      .getArticleBySlug(articleSlug)
      .then(res => {
        if (!res.success || !res.data) {
          setNotFound(true)
          return
        }
        const a = res.data as KbArticle
        if (a.category.slug !== categorySlug) {
          setNotFound(true)
          return
        }
        setArticle(a)
        if (typeof document !== 'undefined' && a.metaTitle) {
          document.title = a.metaTitle
          const metaDesc = document.querySelector('meta[name="description"]')
          if (metaDesc && a.metaDescription) metaDesc.setAttribute('content', a.metaDescription)
        }
        return service.getRelatedArticles(articleSlug)
      })
      .then(listRes => {
        if (listRes?.success && listRes.data) {
          setRelated(listRes.data as KbArticleListItem[])
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [articleSlug, categorySlug, service])

  useEffect(() => {
    if (!article?.id) return
    const sessionId = getOrCreateFeedbackSessionId()
    service.checkFeedbackStatus(article.id, sessionId).then(r => {
      if (r.success && r.data) {
        const data = r.data as { hasVoted: boolean; isHelpful?: boolean }
        if (data.hasVoted && data.isHelpful !== undefined) {
          setFeedbackSent(data.isHelpful ? 'yes' : 'no')
        }
      }
    })
  }, [article?.id, service])

  const sendFeedback = useCallback(
    (helpful: boolean) => {
      if (!article || feedbackLoading) return
      setFeedbackLoading(true)
      const sessionId = getOrCreateFeedbackSessionId()
      service
        .submitArticleFeedback(article.id, helpful, sessionId)
        .then(result => {
          if (result.success) {
            setFeedbackSent(helpful ? 'yes' : 'no')
          }
        })
        .finally(() => setFeedbackLoading(false))
    },
    [article, feedbackLoading, service]
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-8 h-5 w-64 animate-pulse rounded bg-gray-50" />
        <div className="h-8 w-full animate-pulse rounded bg-gray-50" />
      </div>
    )
  }

  if (notFound || !article) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 text-center">
        <p className="text-gray-500">Article not found.</p>
        <Link href={basePath} className="mt-4 inline-block text-secondary underline">
          Back to Help Center
        </Link>
      </div>
    )
  }

  const typeInfo = articleTypeLabel(article.articleType)

  return (
    <>
      <nav className="mx-auto max-w-3xl px-5 pt-6" aria-label="Breadcrumb">
        <Breadcrumbs variant="light" color="foreground">
          <BreadcrumbItem href={basePath}>Help Center</BreadcrumbItem>
          <BreadcrumbItem href={`${basePath}/${categorySlug}`}>
            {article.category.name}
          </BreadcrumbItem>
          <BreadcrumbItem>{article.title}</BreadcrumbItem>
        </Breadcrumbs>
      </nav>

      <main className="mx-auto max-w-3xl px-5 py-8 pb-20">
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
            <Button
              disabled={feedbackLoading}
              onPress={() => sendFeedback(true)}
              variant={feedbackSent === 'yes' ? 'flat' : 'bordered'}
              color={feedbackSent === 'yes' ? 'primary' : 'default'}
              className={feedbackSent === 'yes' ? 'border-2 border-primary' : ''}
            >
              Yes
            </Button>
            <Button
              disabled={feedbackLoading}
              onPress={() => sendFeedback(false)}
              variant={feedbackSent === 'no' ? 'flat' : 'bordered'}
              color={feedbackSent === 'no' ? 'primary' : 'default'}
              className={feedbackSent === 'no' ? 'border-2 border-primary' : ''}
            >
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
                    href={`${basePath}/${r.category.slug}/${r.slug}`}
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
          <HelpContactCta supportHref={supportHref} />
        </div>
      </main>
    </>
  )
}
