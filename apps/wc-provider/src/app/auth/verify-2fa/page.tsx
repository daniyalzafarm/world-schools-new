'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@heroui/react'
import { InputOtp } from '@heroui/input-otp'
import { Logo } from '@/components/layout/logo'
import apiClient from '@/utils/api-client'
import { useAuthStore } from '@/stores/auth-store'
import config from '@/config/config'

function Verify2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const userId = searchParams.get('userId')
  const email = searchParams.get('email')

  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)

  // Redirect if no userId or email
  useEffect(() => {
    if (!userId || !email) {
      router.push('/auth/signin')
    }
  }, [userId, email, router])

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && !isLoading) {
      handleSubmit(new Event('submit') as any).catch(error => {
        console.error('Auto-submit error:', error)
      })
    }
  }, [code])

  // Timer for resend cooldown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [resendTimer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !email) return

    setIsLoading(true)
    setError('')

    try {
      const response = await apiClient.post('/provider/auth/two-factor/verify-code', {
        userId,
        code,
      })

      // Check if the response includes user data
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

        // Redirect to home page immediately
        router.replace('/')
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

  const handleResend = async () => {
    if (!userId || !email || resendTimer > 0) return

    setIsLoading(true)
    setError('')

    try {
      await apiClient.post('/provider/auth/two-factor/send-code', {
        userId,
        email,
      })

      setResendTimer(30)
      setCode('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.')
    } finally {
      setIsLoading(false)
    }
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
              <h1 className="text-2xl font-bold text-secondary-500">Two-Factor Authentication</h1>
              <p className="text-sm text-gray-500">
                We&apos;ve sent a 6-digit verification code to{' '}
                <span className="font-semibold text-secondary-500">{email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Verify2FAContent />
    </Suspense>
  )
}
