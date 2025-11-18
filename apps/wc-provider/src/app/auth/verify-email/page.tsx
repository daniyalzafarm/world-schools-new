'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Link } from '@heroui/react'
import { InputOtp } from '@heroui/input-otp'
import { CheckCircle } from 'lucide-react'

import { Logo } from '@/components/layout/logo'
import { resendVerificationCode, verifyEmail } from '@/services/auth.services'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/utils/api-client'
import config from '@/config/config'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get auth mode configuration
  const usingRequest = config.auth.usingRequest

  // Clear validation and API errors when user starts typing
  useEffect(() => {
    setErrors({})
    setError(null)
  }, [code])

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (!code.trim()) {
      nextErrors.code = 'Verification code is required'
    } else if (!/^\d{6}$/.test(code)) {
      nextErrors.code = 'Code must be 6 digits'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    const response = await verifyEmail({ email, code })

    if (response.success) {
      setSuccess(true)

      // Check if the response includes user data (automatic authentication)
      const hasUserData =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'user' in response.data

      if (hasUserData) {
        // User was automatically authenticated after email verification
        const user = (response.data as any).user

        // Handle tokens based on auth mode
        if (usingRequest && response.headers) {
          // Extract tokens from response headers for request-based auth
          const accessToken = response.headers['x-access-token']
          const refreshToken = response.headers['x-refresh-token']
          if (accessToken) {
            apiClient.setTokens(accessToken, refreshToken || '')
          }
        }
        // When not using request headers, tokens are set as HTTP-only cookies by backend

        // Update auth store with user data using the store's setState method
        useAuthStore.setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        // Redirect to dashboard immediately
        router.replace('/dashboard')
      } else {
        // Email verified but user was not authenticated (e.g., doesn't have provider role)
        // Redirect to signin after 2 seconds
        setTimeout(() => {
          router.push('/auth/signin')
        }, 2000)
      }
    } else {
      // Extract error message from API response
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

  const handleResendCode = async () => {
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setIsResending(true)
    setError(null)
    setResendMessage(null)

    const response = await resendVerificationCode({ email })

    if (response.success) {
      setResendMessage('Verification code sent! Please check your email.')
    } else {
      // Extract error message from API response
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to resend code. Please try again.'
      setError(errorMessage)
    }

    setIsResending(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <div className="bg-gray-50 rounded-2xl p-8 space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-secondary-500">Email verified!</h1>
                <p className="text-sm text-gray-500">
                  Your email has been successfully verified. Redirecting to sign in...
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold text-secondary-500">Verify your email</h1>
              <p className="text-sm text-gray-500">
                We've sent a 6-digit verification code to{' '}
                <span className="font-semibold text-secondary-500">{email}</span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            {resendMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600 text-center">
                {resendMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2 flex justify-center">
                <InputOtp
                  value={code}
                  onValueChange={setCode}
                  length={6}
                  variant="bordered"
                  size="lg"
                  color={errors.code || error ? 'danger' : 'default'}
                  radius="md"
                  classNames={{
                    base: 'gap-2',
                    input: 'text-center text-lg font-bold',
                  }}
                />
                {errors.code && <p className="text-sm text-red-600">{errors.code}</p>}
              </div>

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

              <div className="text-center space-y-2">
                <div className="text-center text-sm text-gray-500">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResending}
                    className="cursor-pointer font-bold text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {isResending ? 'Sending...' : "Resend"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
