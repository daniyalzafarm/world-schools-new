'use client'

import { useCallback } from 'react'

import apiClient from '@/utils/api-client'
import config from '@/config/config'
import { useAuthStore } from '@/stores/auth-store'
import { googleSignIn } from '@/services/auth.services'

interface GoogleSignInResult {
  ok: boolean
  error?: string
}

/**
 * Completes a Google sign-in from an ID-token credential and hydrates the auth
 * store. Shared by the Google button and One Tap so both authenticate identically.
 *
 * Mirrors the store hydration used by the non-login auth endpoints (e.g. 2FA verify):
 * in request-based auth mode the tokens are read from response headers; otherwise
 * the backend has already set HTTP-only cookies.
 */
export function useGoogleSignIn() {
  const completeGoogleSignIn = useCallback(
    async (credential: string): Promise<GoogleSignInResult> => {
      try {
        const response = await googleSignIn({ credential })

        const hasUserData =
          response.success &&
          'data' in response &&
          response.data &&
          typeof response.data === 'object' &&
          'user' in response.data

        if (!hasUserData) {
          const message =
            'data' in response &&
            response.data &&
            typeof response.data === 'object' &&
            'message' in response.data
              ? (response.data.message as string)
              : 'Google sign-in failed. Please try again.'
          return { ok: false, error: message }
        }

        const user = (response.data as any).user

        // Request-based auth: pull tokens from headers. Cookie-based auth: the
        // backend already set HTTP-only cookies, nothing to do here.
        if (config.auth.usingRequest && response.headers) {
          const accessToken = response.headers['x-access-token']
          const refreshToken = response.headers['x-refresh-token']
          if (accessToken) {
            apiClient.setTokens(accessToken, refreshToken || '')
          }
        }

        useAuthStore.setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        return { ok: true }
      } catch (error: any) {
        return {
          ok: false,
          error: error?.response?.data?.message || 'Google sign-in failed. Please try again.',
        }
      }
    },
    []
  )

  return { completeGoogleSignIn }
}
