'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { InputOtp } from '@heroui/input-otp'

import apiClient from '@/utils/api-client'
import { useAuthStore } from '@/stores/auth-store'
import config from '@/config/config'
import { AuthFormShell } from '@/components/auth/forms/auth-form-shell'

interface Verify2FAFormProps {
  userId: string
  email: string
  /** Verified and authenticated. */
  onSuccess: () => void
}

export function Verify2FAForm({ userId, email, onSuccess }: Verify2FAFormProps) {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)

  // Auto-submit when the code is complete
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && !isLoading) {
      void submit(code)
    }
  }, [code])

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

  const submit = async (codeToVerify: string) => {
    if (!userId || !email) return

    setIsLoading(true)
    setError('')

    try {
      const response = await apiClient.post('/user/auth/two-factor/verify-code', {
        userId,
        code: codeToVerify,
      })

      const hasUserData =
        response.success &&
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'user' in response.data

      if (hasUserData) {
        const user = (response.data as any).user

        // Handle tokens based on auth mode (same logic as auth store's login method)
        if (config.auth.usingRequest && response.headers) {
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
        setError('Verification failed. Please try again.')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired verification code')
      setCode('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submit(code)
  }

  const handleResend = async () => {
    if (!userId || !email || resendTimer > 0) return

    setIsLoading(true)
    setError('')

    try {
      await apiClient.post('/user/auth/two-factor/send-code', { userId, email })
      setResendTimer(30)
      setCode('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthFormShell
      title="Two-Factor Authentication"
      description={
        <>
          We&apos;ve sent a 6-digit verification code to{' '}
          <span className="font-semibold text-secondary-500">{email}</span>
        </>
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
            {isLoading ? 'Verifying…' : 'Verify Code'}
          </Button>

          <div className="text-center text-sm text-gray-500">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || isLoading}
              className="cursor-pointer font-bold text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
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
          isDisabled={isLoading}
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
