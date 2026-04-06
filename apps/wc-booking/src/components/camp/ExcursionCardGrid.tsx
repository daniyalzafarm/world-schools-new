'use client'

import { useState } from 'react'
import type { ActivityItem } from '../../types/camps'

const DESKTOP_PAGE_SIZE = 3

interface ExcursionCardGridProps {
  items: ActivityItem[]
  /** Controlled page index — when provided together with onPageChange, hides the internal nav row */
  page?: number
  onPageChange?: (page: number) => void
  onPhotoClick?: () => void
  showCaptions?: boolean
}

export function ExcursionCardGrid({
  items,
  page: controlledPage,
  onPageChange,
  onPhotoClick,
  showCaptions = false,
}: ExcursionCardGridProps) {
  if (!items || items.length === 0) return null

  const isControlled = controlledPage !== undefined && onPageChange !== undefined

  return (
    <>
      {/* Mobile: horizontal scroll, 2 cards + peek of 3rd */}
      <div className="md:hidden -mx-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-6 pb-1">
          {items.map(item => (
            <div key={item.id} className="shrink-0" style={{ width: '42vw' }}>
              <ExcursionCard item={item} onClick={onPhotoClick} showCaptions={showCaptions} />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: paginated carousel */}
      <DesktopCarousel
        items={items}
        controlledPage={isControlled ? controlledPage : undefined}
        onPageChange={isControlled ? onPageChange : undefined}
        onPhotoClick={onPhotoClick}
        showCaptions={showCaptions}
      />
    </>
  )
}

function DesktopCarousel({
  items,
  controlledPage,
  onPageChange,
  onPhotoClick,
  showCaptions,
}: {
  items: ActivityItem[]
  controlledPage?: number
  onPageChange?: (page: number) => void
  onPhotoClick?: () => void
  showCaptions?: boolean
}) {
  const [internalPage, setInternalPage] = useState(0)
  const isControlled = controlledPage !== undefined && onPageChange !== undefined
  const page = isControlled ? controlledPage : internalPage
  const setPage = (n: number) => (isControlled ? onPageChange!(n) : setInternalPage(n))
  const totalPages = Math.ceil(items.length / DESKTOP_PAGE_SIZE)
  const visibleItems = items.slice(page * DESKTOP_PAGE_SIZE, (page + 1) * DESKTOP_PAGE_SIZE)

  return (
    <div className="hidden md:block">
      {/* Nav row — only shown in uncontrolled mode */}
      {!isControlled && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="text-sm text-gray-500 mr-1">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            aria-label="Previous"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            aria-label="Next"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {visibleItems.map(item => (
          <ExcursionCard
            key={item.id}
            item={item}
            onClick={onPhotoClick}
            showCaptions={showCaptions}
          />
        ))}
      </div>
    </div>
  )
}

function ExcursionCard({
  item,
  onClick,
  showCaptions,
}: {
  item: ActivityItem
  onClick?: () => void
  showCaptions?: boolean
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 ${onClick ? 'cursor-pointer group' : ''}`}
      onClick={onClick}
    >
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={item.name}
          className={`w-full object-cover ${onClick ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
          style={{ aspectRatio: '4 / 3' }}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
          style={{ aspectRatio: '4 / 3' }}
        >
          <span className="text-2xl">{item.icon}</span>
        </div>
      )}
      {showCaptions && item.name && (
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
          {item.subtitle && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{item.subtitle}</p>
          )}
        </div>
      )}
    </div>
  )
}
