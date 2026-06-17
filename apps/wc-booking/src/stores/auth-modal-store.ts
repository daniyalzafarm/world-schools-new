import { create } from 'zustand'

import { useAuthStore } from '@/stores/auth-store'

export type AuthModalView = 'signin' | 'signup' | 'forgot' | 'verify-email' | 'verify-2fa'

/** Drives the contextual modal title ("Log in to book", etc.). */
export type AuthModalContext = 'generic' | 'message' | 'save' | 'book' | 'review'

interface OpenOptions {
  view?: AuthModalView
  context?: AuthModalContext
  /** Action to resume once the user successfully authenticates (e.g. open the wishlist modal). */
  onSuccess?: () => void
}

interface AuthModalState {
  isOpen: boolean
  view: AuthModalView
  context: AuthModalContext
  /** Flow params carried between steps (e.g. signin -> verify-2fa). */
  email?: string
  userId?: string
  onSuccess?: () => void
}

interface AuthModalActions {
  open: (options?: OpenOptions) => void
  close: () => void
  setView: (view: AuthModalView) => void
  setFlow: (flow: { email?: string; userId?: string }) => void
  /** Fire the resume action and close. Only call on successful authentication. */
  completeAuth: () => void
}

const DEFAULT_STATE: AuthModalState = {
  isOpen: false,
  view: 'signin',
  context: 'generic',
  email: undefined,
  userId: undefined,
  onSuccess: undefined,
}

export const useAuthModalStore = create<AuthModalState & AuthModalActions>((set, get) => ({
  ...DEFAULT_STATE,

  open: ({ view = 'signin', context = 'generic', onSuccess } = {}) => {
    // Drop any stale auth error so it doesn't flash in the freshly opened modal.
    useAuthStore.getState().clearError()
    set({ isOpen: true, view, context, onSuccess, email: undefined, userId: undefined })
  },

  // Plain dismiss (X / backdrop): never fires onSuccess.
  close: () => set({ ...DEFAULT_STATE }),

  setView: view => {
    // Clear errors when switching steps so a signin error doesn't bleed into signup.
    useAuthStore.getState().clearError()
    set({ view })
  },

  setFlow: ({ email, userId }) =>
    set(state => ({ email: email ?? state.email, userId: userId ?? state.userId })),

  completeAuth: () => {
    const { onSuccess } = get()
    // Close first so the modal tears down (restoring body overflow) before any
    // resumed modal/navigation runs — avoids a body-overflow flicker.
    set({ ...DEFAULT_STATE })
    if (onSuccess) setTimeout(onSuccess, 0)
  },
}))
