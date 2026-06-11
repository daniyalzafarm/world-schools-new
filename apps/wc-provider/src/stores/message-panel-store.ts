'use client'

import { create } from 'zustand'

/**
 * UI state for the messaging right-hand contact panel. The chat header click /
 * panel icon and the panel's close (×) button both drive this.
 *
 * Defaults to closed (WhatsApp Web parity): the provider opens it on demand. On
 * a narrow chat area the panel covers the whole conversation, so auto-opening
 * would hide the messages the provider just navigated to.
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
