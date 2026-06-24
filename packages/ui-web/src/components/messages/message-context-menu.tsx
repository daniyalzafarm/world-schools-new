'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

export interface MessageContextMenuAction {
  key: string
  label: string
  danger?: boolean
  onSelect: () => void
}

/** Trigger rectangle (viewport coords) the menu positions itself against. */
export interface MessageMenuAnchor {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * A small actions menu (5B design) anchored to a trigger — a hover chevron on
 * desktop or the touch point of a long-press on mobile. It measures itself and
 * positions like WhatsApp Web: dropping down from and right-aligned to the
 * anchor, flipping above / shifting horizontally to stay within the viewport.
 */
export function MessageContextMenu({
  anchor,
  actions,
  onClose,
}: {
  anchor: MessageMenuAnchor
  actions: MessageContextMenuAction[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Measure the rendered menu, then place it relative to the anchor with the
  // available space respected (runs before paint, so there's no visible jump).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = 4
    const MARGIN = 8

    // Vertical: prefer below the anchor; flip above when it would overflow.
    let top = anchor.bottom + GAP
    if (top + height + MARGIN > vh) {
      const above = anchor.top - GAP - height
      top = above >= MARGIN ? above : Math.max(MARGIN, vh - height - MARGIN)
    }

    // Horizontal: right-align to the anchor (drops down-left, like WhatsApp Web);
    // if that overflows the left edge, left-align instead, then clamp on-screen.
    let left = anchor.right - width
    if (left < MARGIN) left = anchor.left
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN))

    setPos({ top, left })
  }, [anchor])

  return (
    <>
      {/* Invisible overlay catches the next click/right-click to dismiss. */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={e => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={ref}
        className="fixed z-50 min-w-36 rounded-lg bg-white py-1 shadow-lg dark:bg-gray-800"
        style={{
          top: pos?.top ?? anchor.bottom,
          left: pos?.left ?? anchor.left,
          // Hidden for the single layout tick before useLayoutEffect places it.
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {actions.map((a, i) => (
          <React.Fragment key={a.key}>
            {a.danger && i > 0 && <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />}
            <button
              type="button"
              className={cn(
                'flex w-full items-center px-3.5 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                a.danger ? 'text-rose-500' : 'text-gray-900 dark:text-gray-100'
              )}
              onClick={() => {
                a.onSelect()
                onClose()
              }}
            >
              {a.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    </>
  )
}
