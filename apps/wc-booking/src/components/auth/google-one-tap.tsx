'use client'

import { useGoogleOneTapLogin } from '@react-oauth/google'
import { usePathname } from 'next/navigation'

import { useAuthStore } from '@/stores/auth-store'
import { useGoogleSignIn } from '@/components/auth/use-google-sign-in'

/**
 * Google One Tap auto-prompt for logged-out visitors. Mounted once globally inside
 * GoogleOAuthProvider (see providers.tsx). Suppressed while auth is still
 * initializing, when the user is already authenticated, or on the /auth/* routes
 * where the explicit Google button already shows. FedCM is enabled for
 * forward-compatibility with Google's One Tap migration.
 */
export function GoogleOneTap() {
  const pathname = usePathname()
  const isInitialized = useAuthStore(state => state.isInitialized)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const { completeGoogleSignIn } = useGoogleSignIn()

  const disabled = !isInitialized || isAuthenticated || (pathname?.startsWith('/auth') ?? false)

  useGoogleOneTapLogin({
    disabled,
    use_fedcm_for_prompt: true,
    onSuccess: async credentialResponse => {
      const credential = credentialResponse.credential
      if (credential) {
        await completeGoogleSignIn(credential)
      }
    },
    // One Tap dismissal / ineligibility is non-fatal — the user can still use the button.
    onError: () => {},
  })

  return null
}
