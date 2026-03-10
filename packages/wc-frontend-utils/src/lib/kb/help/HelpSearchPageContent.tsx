'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Search } from 'lucide-react'
import { BreadcrumbItem, Breadcrumbs } from '@heroui/react'
import type { KbArticleListItem } from '@world-schools/wc-types'
import { useHelpKb } from './help-kb-context'
import { highlightSearchText } from './highlight-search-text'

export function HelpSearchPageContent() {
  const { service, basePath, audience, supportHref } = useHelpKb()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [results, setResults] = useState<KbArticleListItem[]>([])
  const [loading, setLoading] = useState(!!q)

  useEffect(() => {
    if (!q || q.length < 2) {
      setLoading(false)
      return
    }
    service
      .getArticles({ search: q, audience, limit: 20 })
      .then(r => setResults(r.success && r.data ? (r.data as KbArticleListItem[]) : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [q, service, audience])

  return (
    <>
      <nav
        className="mx-auto max-w-[800px] px-5 pt-6 text-sm text-gray-500"
        aria-label="Breadcrumb"
      >
        <Breadcrumbs variant="light" color="foreground">
          <BreadcrumbItem href={basePath}>Help Center</BreadcrumbItem>
          <BreadcrumbItem>Search results</BreadcrumbItem>
        </Breadcrumbs>
      </nav>

      <main className="mx-auto max-w-[800px] px-5 py-8 pb-20">
        {!q || q.length < 2 ? (
          <p className="text-[15px] text-gray-500">Enter at least 2 characters to search.</p>
        ) : loading ? (
          <>
            <div className="results-header mb-6">
              <h1 className="results-title text-2xl font-bold text-secondary">Search results</h1>
              <p className="results-count mt-2 text-[15px] text-gray-500">Searching…</p>
            </div>
            <div className="results-list flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="result-item animate-pulse rounded-xl border border-gray-200 bg-white py-5 px-6"
                >
                  <div className="mb-2 h-3 w-20 rounded bg-gray-100" />
                  <div className="mb-2 h-5 w-3/4 rounded bg-gray-100" />
                  <div className="h-4 w-full rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </>
        ) : results.length === 0 ? (
          <div className="no-results py-12 text-center">
            <div className="no-results-icon mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <Search className="h-8 w-8 text-gray-500" strokeWidth={2} />
            </div>
            <h2 className="no-results-title mb-2 text-xl font-semibold text-secondary">
              No results found
            </h2>
            <p className="no-results-text mb-6 text-[15px] text-gray-500">
              We couldn&apos;t find any articles matching &quot;{q}&quot;
            </p>
            <div className="no-results-suggestions mx-auto mb-6 max-w-[400px] rounded-xl bg-gray-50 p-5 text-left">
              <h3 className="no-results-suggestions-title mb-3 text-sm font-semibold text-secondary">
                Try these tips:
              </h3>
              <ul className="ml-5 list-disc text-sm text-gray-500">
                <li className="mb-1.5">Check for spelling errors</li>
                <li className="mb-1.5">Use more general terms</li>
                <li className="mb-1.5">Try different keywords</li>
              </ul>
            </div>
            <Link
              href={supportHref}
              className="contact-cta-btn inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-medium text-white no-underline transition-colors hover:bg-secondary/90"
            >
              <MessageCircle size={18} strokeWidth={2} />
              Contact Support
            </Link>
          </div>
        ) : (
          <>
            <div className="results-header mb-6">
              <h1 className="results-title text-2xl font-bold text-secondary">Search results</h1>
              <p className="results-count mt-2 text-[15px] text-gray-500">
                {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
                <span className="results-query font-semibold text-secondary">&quot;{q}&quot;</span>
              </p>
            </div>

            <div className="results-list flex flex-col gap-4">
              {results.map(art => (
                <Link
                  key={art.id}
                  href={`${basePath}/${art.category.slug}/${art.slug}`}
                  className="result-item block rounded-xl border border-gray-200 bg-white py-5 px-6 no-underline text-inherit transition-all hover:border-secondary hover:shadow-md"
                >
                  <div className="result-category mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {highlightSearchText(art.category.name, q)}
                  </div>
                  <h2 className="result-title mb-2 text-[17px] font-semibold text-secondary">
                    {highlightSearchText(art.title, q)}
                  </h2>
                  {art.summary && (
                    <p className="line-clamp-2 leading-relaxed text-sm text-gray-500">
                      {highlightSearchText(art.summary, q)}
                    </p>
                  )}
                </Link>
              ))}
            </div>

            <section className="contact-cta mt-12 rounded-xl bg-gray-50 p-6 text-center">
              <p className="contact-cta-text mb-4 text-[15px] text-gray-500">
                Didn&apos;t find what you were looking for?
              </p>
              <Link
                href={supportHref}
                className="contact-cta-btn inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-medium text-white no-underline transition-colors hover:bg-secondary/90"
              >
                <MessageCircle size={18} strokeWidth={2} />
                Contact Support
              </Link>
            </section>
          </>
        )}
      </main>
    </>
  )
}
