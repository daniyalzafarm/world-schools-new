'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import type { KbArticleListItem, KbCategory } from '@world-schools/wc-types'
import { useHelpKb } from './help-kb-context'
import { HelpContactCta } from './help-contact-cta'

export function HelpHomePageContent() {
  const { service, basePath, audience, supportHref } = useHelpKb()
  const router = useRouter()
  const [categories, setCategories] = useState<KbCategory[]>([])
  const [popular, setPopular] = useState<KbArticleListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([service.getCategories(), service.getPopularArticles(8)])
      .then(([catsRes, popRes]) => {
        if (catsRes.success && catsRes.data) {
          const cats = (catsRes.data as KbCategory[]).filter(c => (c._count?.articles ?? 0) > 0)
          setCategories(cats)
        }
        if (popRes.success && popRes.data) {
          setPopular(popRes.data as KbArticleListItem[])
        }
      })
      .finally(() => setLoading(false))
  }, [service])

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = searchQuery?.trim()
      if (q && q.length >= 2) {
        router.push(`${basePath}/search?q=${encodeURIComponent(q)}`)
      }
    },
    [searchQuery, router, basePath]
  )

  return (
    <>
      <section className="bg-secondary px-5 py-12 text-center sm:px-5 md:py-[48px] md:pb-[72px]">
        <h1 className="mb-6 text-3xl font-bold text-white md:text-4xl">How can we help?</h1>
        <form onSubmit={handleSearchSubmit} className="mx-auto max-w-[600px]">
          <div className="relative">
            <Search
              className="absolute left-[18px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-zinc-500"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search for articles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border-0 py-4 pl-[52px] pr-6 text-base bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] focus:outline-none focus:ring-2 focus:ring-[#45F0B5]/30 focus:ring-offset-0"
            />
          </div>
        </form>
        {!!popular.length && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[13px] text-white/60">Popular:</span>
            {popular.slice(0, 4).map(a => (
              <Link
                key={a.id}
                href={`${basePath}/${a.category.slug}/${a.slug}`}
                className="rounded-[20px] bg-white/10 px-3 py-1.5 text-[13px] text-white no-underline transition-colors hover:bg-white/20"
              >
                {a.title}
              </Link>
            ))}
          </div>
        )}
      </section>

      <main className="mx-auto max-w-[1200px] px-5 py-12 pb-20 md:py-[48px] md:pb-20">
        {!!categories.length && (
          <h2 className="mb-6 text-center text-2xl font-bold text-secondary md:mb-8">
            Browse by topic
          </h2>
        )}
        {loading ? (
          <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-[180px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50"
              />
            ))}
          </div>
        ) : (
          <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(cat => (
              <Link
                key={cat.id}
                href={`${basePath}/${cat.slug}`}
                className="rounded-2xl border border-gray-200 bg-white p-6 text-left no-underline text-secondary transition-all hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-2xl">
                  {cat.icon ?? '📄'}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-secondary">{cat.name}</h3>
                <p className="mb-4 text-sm leading-snug text-gray-500">{cat.description ?? ''}</p>
                <span className="text-[13px] text-gray-500">
                  {cat._count.articles} article
                  {cat._count.articles !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
        )}

        {popular.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-5 text-xl font-semibold text-secondary">Popular articles</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {popular.map(a => (
                <Link
                  key={a.id}
                  href={`${basePath}/${a.category.slug}/${a.slug}`}
                  className="flex items-center gap-2 rounded-[10px] bg-gray-50 p-4 text-secondary no-underline transition-colors hover:bg-[#EBEBEB]"
                >
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" strokeWidth={2} />
                  <span className="text-[15px]">{a.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <HelpContactCta supportHref={supportHref} />
      </main>
    </>
  )
}
