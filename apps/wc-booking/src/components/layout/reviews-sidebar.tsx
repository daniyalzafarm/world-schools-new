'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { PenLine, Star } from 'lucide-react'

interface ReviewsSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  publishedCount: number
  eligibleCount: number
}

export const ReviewsSidebar: React.FC<ReviewsSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  publishedCount,
  eligibleCount,
}) => {
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigation = (href: string) => {
    router.push(href)
    setSidebarOpen(false)
  }

  const isMyReviewsActive = pathname === '/reviews'
  const isWriteActive = pathname.startsWith('/reviews/write')

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-full bg-white dark:bg-slate-900/95 backdrop-blur-md',
          'border-r border-slate-200 dark:border-slate-700',
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          'w-full lg:w-70',
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="px-6 pt-8 pb-6">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Reviews</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 pb-6">
            <div className="space-y-1">
              {/* My Reviews */}
              <div
                onClick={() => handleNavigation('/reviews')}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm',
                  isMyReviewsActive
                    ? 'bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <span
                  className={cn(
                    'shrink-0',
                    isMyReviewsActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                  )}
                >
                  <Star size={20} />
                </span>
                <span className="flex-1">My Reviews</span>
                {publishedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                    {publishedCount}
                  </span>
                )}
              </div>

              {/* Write a Review */}
              <div
                onClick={() => handleNavigation('/reviews/write')}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm',
                  isWriteActive
                    ? 'bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <span
                  className={cn(
                    'shrink-0',
                    isWriteActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                  )}
                >
                  <PenLine size={20} />
                </span>
                <span className="flex-1">Write a Review</span>
                {eligibleCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    {eligibleCount}
                  </span>
                )}
              </div>
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}
