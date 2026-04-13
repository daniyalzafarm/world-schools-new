'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight, FileText } from 'lucide-react'
import { BreadcrumbItem, Breadcrumbs } from '@heroui/react'
import type { KbArticleListItem, KbCategory } from '@world-schools/wc-types'
import { useHelpKb } from './help-kb-context'
import { articleTypeLabel } from './article-type-label'
import { HelpContactCta } from './help-contact-cta'

export function HelpCategoryPageContent() {
  const { service, basePath, audience, supportHref } = useHelpKb()
  const params = useParams()
  const categorySlug = params['categorySlug'] as string
  const [category, setCategory] = useState<KbCategory | null>(null)
  const [articles, setArticles] = useState<KbArticleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    service
      .getCategories()
      .then(catsRes => {
        if (!catsRes.success || !catsRes.data) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const cats = catsRes.data as KbCategory[]
        const cat = cats.find(c => c.slug === categorySlug)
        if (!cat) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setCategory(cat)
        return service.getArticles({
          categoryId: cat.id,
          audience,
          limit: 100,
        })
      })
      .then(result => {
        if (result?.success && result.data) {
          setArticles(result.data as KbArticleListItem[])
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [categorySlug, service, audience])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-8 h-6 w-48 animate-pulse rounded bg-gray-50" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-50" />
      </div>
    )
  }

  if (notFound || !category) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12 text-center">
        <p className="text-gray-500">Category not found.</p>
        <Link href={basePath} className="mt-4 inline-block text-secondary underline">
          Back to Help Center
        </Link>
      </div>
    )
  }

  return (
    <>
      <nav className="mx-auto max-w-4xl px-5 pt-6" aria-label="Breadcrumb">
        <Breadcrumbs variant="light" color="foreground">
          <BreadcrumbItem href={basePath}>Help Center</BreadcrumbItem>
          <BreadcrumbItem>{category.name}</BreadcrumbItem>
        </Breadcrumbs>
      </nav>

      <main className="mx-auto max-w-4xl px-5 py-8 pb-20">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-3xl">
            {category.icon ?? '📄'}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-secondary md:text-3xl">{category.name}</h1>
            <p className="mt-1 text-base text-gray-500">{category.description ?? ''}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          {articles.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              No articles in this category yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {articles.map(art => (
                <li key={art.id}>
                  <Link
                    href={`${basePath}/${categorySlug}/${art.slug}`}
                    className="flex items-center gap-4 bg-white px-6 py-5 transition-colors hover:bg-gray-50 sm:px-6"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50">
                      <FileText className="h-5 w-5 text-gray-500" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-medium text-secondary">{art.title}</span>
                        <span className={articleTypeLabel(art.articleType).className}>
                          {articleTypeLabel(art.articleType).label}
                        </span>
                      </div>
                      {art.summary && (
                        <p className="line-clamp-2 leading-relaxed text-gray-500">{art.summary}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-12">
          <HelpContactCta supportHref={supportHref} />
        </div>
      </main>
    </>
  )
}
