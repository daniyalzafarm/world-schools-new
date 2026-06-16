'use client'

import { Button, Skeleton } from '@heroui/react'
import { X } from 'lucide-react'
import { useMessagingStore } from '@/stores/messaging-store'
import { useMessagePanelStore } from '@/stores/message-panel-store'
import { type ContactProfileState, useContactProfile } from '@/hooks/use-contact-profile'
import { AboutSection, ChildrenSection, IdentitySection, ReviewSection } from './panel-sections'

const PANEL_WIDTH = 'w-[380px]'

function PanelBody({ state }: { state: ContactProfileState }) {
  if (state.kind === 'loading') {
    return (
      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  if (state.kind !== 'profile') return null

  return (
    <div className="flex-1 overflow-y-auto">
      <IdentitySection data={state.data} />
      <AboutSection data={state.data} />
      <ChildrenSection data={state.data} />
      <ReviewSection data={state.data} />
    </div>
  )
}

export function ContactProfilePanel({ overlay = false }: { overlay?: boolean }) {
  const { activeConversationId, conversations } = useMessagingStore()
  const { isPanelOpen, setPanelOpen } = useMessagePanelStore()

  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null
  const state = useContactProfile(activeConversation)

  // Hidden for non-parent conversations (e.g. support) or no selection.
  if (!activeConversation || state.kind === 'none') return null

  const campName =
    (activeConversation as { campName?: string | null }).campName ??
    (state.kind === 'profile' ? state.data.campName : null)

  const inner = (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <header className="h-20 flex items-start justify-between gap-3 border-b border-default-200 px-6 py-4 dark:border-slate-700">
        <div className="min-w-0">
          <p className="text-base font-semibold text-secondary">Inquiry</p>
          {campName ? <p className="truncate text-sm text-default-500">{campName}</p> : null}
        </div>
        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="light"
          aria-label="Close panel"
          onPress={() => setPanelOpen(false)}
          className="-mr-2 text-secondary"
        >
          <X size={20} />
        </Button>
      </header>
      <PanelBody state={state} />
    </div>
  )

  // Overlay mode: chat area too narrow to fit chat + panel side by side, so the
  // open panel covers the whole chat region (WhatsApp Web behaviour).
  if (overlay) {
    return (
      <aside
        className={`absolute inset-0 z-30 transition-transform duration-300 ease-in-out ${
          isPanelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!isPanelOpen}
      >
        {inner}
      </aside>
    )
  }

  // Inline mode: collapsible right column the chat narrows beside.
  return (
    <aside
      className={`shrink-0 overflow-hidden border-l border-default-200 transition-all duration-300 ease-in-out dark:border-slate-700 ${
        isPanelOpen ? `${PANEL_WIDTH} opacity-100` : 'w-0 opacity-0'
      }`}
    >
      <div className={PANEL_WIDTH + ' h-full'}>{inner}</div>
    </aside>
  )
}
