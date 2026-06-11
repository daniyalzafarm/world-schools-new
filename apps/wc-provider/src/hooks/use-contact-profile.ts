'use client'

import { useEffect, useState } from 'react'
import type { ConversationResponseDto } from '@world-schools/wc-frontend-utils'
import { getContactProfile, type ProviderContactProfile } from '@/services/contact-profile.services'

export type ContactProfileState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'profile'; data: ProviderContactProfile }

/**
 * Resolves the contact profile backing the provider messaging panel for the
 * active conversation. Only provider↔parent conversations have a profile;
 * support (`USER_SUPERADMIN`) and empty selections resolve to `none` so the
 * panel stays hidden.
 */
export function useContactProfile(
  conversation: ConversationResponseDto | null
): ContactProfileState {
  const conversationId = conversation?.id ?? null
  const isParentConversation = conversation?.type === 'USER_PROVIDER'

  const [state, setState] = useState<ContactProfileState>({ kind: 'none' })

  useEffect(() => {
    if (!conversationId || !isParentConversation) {
      setState({ kind: 'none' })
      return
    }

    let cancelled = false
    setState({ kind: 'loading' })

    getContactProfile(conversationId)
      .then(data => {
        if (cancelled) return
        setState(data ? { kind: 'profile', data } : { kind: 'none' })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'none' })
      })

    return () => {
      cancelled = true
    }
  }, [conversationId, isParentConversation])

  return state
}
