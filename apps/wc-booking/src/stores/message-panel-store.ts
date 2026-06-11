'use client'

import { create } from 'zustand'

/**
 * UI state for the messaging right-hand context panel. The chat header's info
 * button and the panel's close (×) button both drive this; the panel itself and
 * the header live in different component trees, so a tiny shared store is the
 * simplest way to coordinate them.
 *
 * Defaults to closed (WhatsApp Web parity): the parent opens it on demand via
 * the chat header click or the panel icon. This matters for the responsive
 * behavior — on a narrow chat area the panel covers the whole conversation, so
 * auto-opening would hide the messages the parent just navigated to.
 */
interface MessagePanelStore {
  isPanelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
}

export const useMessagePanelStore = create<MessagePanelStore>(set => ({
  isPanelOpen: false,
  setPanelOpen: open => set({ isPanelOpen: open }),
  togglePanel: () => set(state => ({ isPanelOpen: !state.isPanelOpen })),
}))
