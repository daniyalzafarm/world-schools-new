import React from 'react'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wraps occurrences of `query` in `text` with <mark> for highlight.
 * Returns React nodes for use in shared help search results.
 */
export function highlightSearchText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-yellow-100 px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}
