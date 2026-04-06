'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react'
import { Input } from '@world-schools/ui-web'
import type { Camp } from '@/types/camps'
import { getCampBySlug, searchCamps } from '@/services/camps.services'

interface CampSearchPopoverProps {
  currentCamp: Camp | null
  onSelect: (camp: Camp) => void
  placeholder?: string
}

function thumbnailUrl(camp: Camp): string | null {
  const photos = camp.photos
  if (!Array.isArray(photos) || photos.length === 0) return null
  const p = photos[0] as any
  return typeof p === 'string' ? p : (p?.url ?? null)
}

export function CampSearchPopover({
  currentCamp,
  onSelect,
  placeholder = 'Search camps…',
}: CampSearchPopoverProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Camp[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingCamp, setIsLoadingCamp] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }
    setIsSearching(true)
    try {
      const camps = await searchCamps(q)
      setResults(camps)
      setIsOpen(camps.length > 0)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(val), 320)
  }

  function handleClearQuery() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    // Slot selection is intentionally NOT cleared here
  }

  async function handleSelect(camp: Camp) {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setIsLoadingCamp(true)
    try {
      const full = await getCampBySlug(camp.slug)
      onSelect(full)
    } catch {
      onSelect(camp)
    } finally {
      setIsLoadingCamp(false)
    }
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  const isBusy = isSearching || isLoadingCamp

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) setIsOpen(false)
      }}
      placement="bottom-start"
      offset={4}
      shouldCloseOnBlur={false}
    >
      <PopoverTrigger>
        <div onClick={e => e.preventDefault()}>
          <Input
            value={query}
            onValueChange={handleChange}
            onClear={handleClearQuery}
            isClearable
            placeholder={currentCamp ? currentCamp.name : placeholder}
            startContent={
              isBusy ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#1E2A4A] shrink-0" />
              ) : (
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )
            }
            // Prevent the PopoverTrigger click from toggling the popover
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-[250px] max-h-[300px] overflow-hidden overflow-y-auto rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100">
        <div>
          {results.map(camp => {
            const thumb = thumbnailUrl(camp)
            return (
              <button
                key={camp.id}
                type="button"
                className="cursor-pointer flex items-center gap-3 w-full px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                onMouseDown={e => {
                  e.preventDefault()
                  void handleSelect(camp)
                }}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  {thumb ? (
                    <img src={thumb} alt={camp.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300" />
                  )}
                </div>
                <div className="min-w-0 max-w-[180px]">
                  <div className="text-xs font-semibold text-[#1E2A4A] truncate">{camp.name}</div>
                  {camp.locationName && (
                    <div className="text-xs text-gray-500 truncate">{camp.locationName}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
