'use client'

import React, { useEffect, useRef, useState } from 'react'
import { BottomNav } from './bottom-nav'
import { Sidebar } from './sidebar'
import { MessagesSidebar } from './messages-sidebar'
import { MessageContextPanel } from '@/components/messages/context-panel/MessageContextPanel'
import { useMessagingStore } from '@/stores/messaging-store'

interface MessagesMainLayoutProps {
  children: React.ReactNode
}

/** Below this chat-area width the context panel covers the chat instead of
 * sitting beside it: chat minimum (480) + panel width (380). */
const PANEL_OVERLAY_THRESHOLD = 860

export function MessagesMainLayout({ children }: MessagesMainLayoutProps) {
  const activeConversationId = useMessagingStore(state => state.activeConversationId)
  const [messagesSidebarOpen, setMessagesSidebarOpen] = useState(false)
  // List view (and the bottom nav) whenever no conversation is open.
  const isListView = !activeConversationId

  // Measure the chat-area region (chat + panel) so the panel can switch between
  // a side column and a full-cover overlay based on its own available width —
  // independent of the viewport (WhatsApp Web behaviour).
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const [panelOverlay, setPanelOverlay] = useState(false)

  useEffect(() => {
    const el = chatAreaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0
      setPanelOverlay(width < PANEL_OVERLAY_THRESHOLD)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // On mobile, switch list↔chat from the active conversation (state-based, like
  // wc-provider) instead of the route — so opening a chat stays on /messages.
  useEffect(() => {
    const updateSidebarVisibility = () => {
      if (window.innerWidth >= 1024) {
        // Desktop: MessagesSidebar is lg:static — state not relevant
        setMessagesSidebarOpen(false)
      } else if (activeConversationId) {
        // Mobile conversation view: hide sidebar, show chat
        setMessagesSidebarOpen(false)
      } else {
        // Mobile list view: show conversation list full-screen
        setMessagesSidebarOpen(true)
      }
    }

    updateSidebarVisibility()
    window.addEventListener('resize', updateSidebarVisibility)
    return () => window.removeEventListener('resize', updateSidebarVisibility)
  }, [activeConversationId])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Application Sidebar — always closed on mobile (no trigger); always static on desktop */}
      <Sidebar sidebarOpen={false} setSidebarOpen={() => {}} />

      {/* Messages Sidebar — full-screen on mobile list view, w-96 panel on desktop */}
      <MessagesSidebar sidebarOpen={messagesSidebarOpen} setSidebarOpen={setMessagesSidebarOpen} />

      {/* Chat area region (conversation + context panel). Relative so the panel
          can cover exactly this region as an overlay when it gets too narrow. */}
      <div ref={chatAreaRef} className="relative flex flex-1 min-w-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-auto">
            <div className="h-full">{children}</div>
          </main>
          {/* Show bottom nav on conversation list, hide it inside a conversation */}
          {isListView && <BottomNav />}
        </div>

        {/* Right context panel — camp/booking info for the active conversation */}
        <MessageContextPanel overlay={panelOverlay} />
      </div>
    </div>
  )
}
