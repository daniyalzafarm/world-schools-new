'use client'

import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { Spinner } from '@heroui/react'

import config from '@/config/config'
import { useGoogleSignIn } from '@/components/auth/use-google-sign-in'

// Google's GSI-rendered button requires a pixel width and caps it at 400px, so we
// measure the container and match the form's full-width primary button up to that cap.
const MIN_GSI_WIDTH = 200
const MAX_GSI_WIDTH = 400

interface GoogleAuthButtonProps {
  /** Fired after a fully-authenticated Google sign-in (mirrors the email form's success path). */
  onSuccess: () => void
  /**
   * Notifies the parent form when the post-popup credential exchange is in flight, so it can
   * disable its own inputs/actions for the duration.
   */
  onLoadingChange?: (loading: boolean) => void
}

/** Official multi-color Google "G" mark (matches the GSI button logo). */
function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/**
 * "Continue with Google" — the official Google Identity button (ID-token credential
 * flow). Renders nothing when no client ID is configured, so environments without
 * Google auth fall back to email-only. Preceded by an "or" divider that separates it
 * from the email form above it.
 */
export function GoogleAuthButton({ onSuccess, onLoadingChange }: GoogleAuthButtonProps) {
  const { completeGoogleSignIn } = useGoogleSignIn()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [buttonWidth, setButtonWidth] = useState(0)

  // Track the container width so the Google button fills it like the primary button does.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const width = Math.round(el.getBoundingClientRect().width)
      setButtonWidth(Math.min(Math.max(width, MIN_GSI_WIDTH), MAX_GSI_WIDTH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!config.google.oauthClientId) return null

  const setProcessing = (value: boolean) => {
    setIsProcessing(value)
    onLoadingChange?.(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {/* Once the Google popup closes we still have to exchange the credential for a session
          (sign-in + profile). Swap the button for a Google-styled loading state so it reads as
          the same control, just busy — works the same in the modal and the full-page routes.
          Left up on success — the modal closes / page navigates and unmounts us. */}
      <div ref={containerRef} className="flex min-h-10 items-center justify-center">
        {isProcessing ? (
          <div
            aria-busy="true"
            style={{ width: buttonWidth || undefined }}
            className="flex h-10 max-w-full items-center justify-center gap-2.5 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700"
          >
            <GoogleGLogo className="h-4.5 w-4.5" />
            <span>Signing you in…</span>
            <Spinner size="sm" color="default" />
          </div>
        ) : buttonWidth > 0 ? (
          <GoogleLogin
            onSuccess={async credentialResponse => {
              const credential = credentialResponse.credential
              if (!credential) {
                setError('Google sign-in failed. Please try again.')
                return
              }
              setError(null)
              setProcessing(true)
              const result = await completeGoogleSignIn(credential)
              if (result.ok) {
                onSuccess()
              } else {
                setError(result.error ?? 'Google sign-in failed. Please try again.')
                setProcessing(false)
              }
            }}
            onError={() => setError('Google sign-in was cancelled or failed. Please try again.')}
            theme="outline"
            size="large"
            text="continue_with"
            shape="pill"
            logo_alignment="center"
            width={buttonWidth}
          />
        ) : null}
      </div>
    </div>
  )
}
