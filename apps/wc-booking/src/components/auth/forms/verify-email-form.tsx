'use client'

import React, { useEffect, useState } from 'react'
import { addToast, Button } from '@heroui/react'
import { InputOtp } from '@heroui/input-otp'
import { CheckCircle } from 'lucide-react'

import { resendVerificationCode, verifyEmail } from '@/services/auth.services'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/utils/api-client'
import config from '@/config/config'
import { AuthFormShell } from '@/components/auth/forms/auth-form-shell'

interface VerifyEmailFormProps {
  email: string
  /** Pre-filled code (e.g. from an email-link `?code=`). Triggers auto-verification. */
  initialCode?: string
  /** Verified and authenticated. */
  onSuccess: () => void
  /** Verified but not authenticated (e.g. missing parent role) — send the user to sign in. */
  onRequiresSignIn: () => void
}

export function VerifyEmailForm({
  email,
  initialCode = '',
  onSuccess,
  onRequiresSignIn,
}: VerifyEmailFormProps) {
  const [code, setCode] = useState(initialCode)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const usingRequest = config.auth.usingRequest

  // Start cooldown timer on mount (a code was just sent during signup)
  useEffect(() => {
    setResendTimer(30)
  }, [])

  // Tick down the resend cooldown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [resendTimer])

  // Clear API error when the user edits the code
  useEffect(() => {
    setError(null)
  }, [code])

  // Auto-submit once a full 6-digit code is present (covers both manual entry and `initialCode`)
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && !isLoading && email.trim()) {
      void verify(code)
    }
  }, [code])

  const verify = async (codeToVerify: string) => {
    if (!email.trim() || !/^\d{6}$/.test(codeToVerify)) {
      setError('Please enter the 6-digit code we sent you.')
      return
    }

    setIsLoading(true)
    setError(null)

    const response = await verifyEmail({ email, code: codeToVerify })

    if (response.success) {
      setSuccess(true)

      const hasUserData =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'user' in response.data

      if (hasUserData) {
        const user = (response.data as any).user

        // Handle tokens based on auth mode
        if (usingRequest && response.headers) {
          const accessToken = response.headers['x-access-token']
          const refreshToken = response.headers['x-refresh-token']
          if (accessToken) {
            apiClient.setTokens(accessToken, refreshToken || '')
          }
        }
        // When not using request headers, tokens are set as HTTP-only cookies by backend

        useAuthStore.setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        onSuccess()
      } else {
        // Email verified but user was not authenticated (e.g. doesn't have parent role)
        setTimeout(onRequiresSignIn, 2000)
      }
    } else {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Verification failed. Please check your code and try again.'
      setError(errorMessage)
    }

    setIsLoading(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void verify(code)
  }

  const handleResendCode = async () => {
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setIsResending(true)

    const response = await resendVerificationCode({ email })

    if (response.success) {
      addToast({
        title: 'Success',
        description: 'Verification code sent! Please check your email.',
        color: 'success',
        timeout: 5000,
      })
      setResendTimer(30)
    } else {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to resend code. Please try again.'
      addToast({
        title: 'Error',
        description: errorMessage,
        color: 'danger',
        timeout: 5000,
      })
    }

    setIsResending(false)
  }

  if (success) {
    return (
      <AuthFormShell>
        <div className="space-y-6 pt-2 text-center">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-secondary-500">Email verified!</h1>
            <p className="text-sm text-gray-500">Your email has been successfully verified.</p>
          </div>
        </div>
      </AuthFormShell>
    )
  }

  return (
    <AuthFormShell
      title="Verify your email"
      description={
        initialCode ? (
          'Click the button below to verify your email, or enter the code manually.'
        ) : (
          <>
            We&apos;ve sent a 6-digit verification code to{' '}
            <span className="font-semibold text-secondary-500">{email}</span>
          </>
        )
      }
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            type="submit"
            size="lg"
            radius="full"
            color="primary"
            className="w-full font-semibold"
            isLoading={isLoading}
            isDisabled={isLoading}
          >
            {isLoading ? 'Verifying…' : 'Verify email'}
          </Button>

          <div className="text-center text-sm text-gray-500">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending || resendTimer > 0}
              className="cursor-pointer font-bold text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending
                ? 'Sending...'
                : resendTimer > 0
                  ? `Resend in ${resendTimer}s`
                  : 'Resend'}
            </button>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center">
        <InputOtp
          value={code}
          onValueChange={setCode}
          length={6}
          variant="bordered"
          size="lg"
          color={error ? 'danger' : 'default'}
          radius="md"
          classNames={{
            base: 'gap-2',
            input: 'text-center text-lg font-bold',
          }}
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </AuthFormShell>
  )
}
