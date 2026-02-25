'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Link } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

export default function SignInPage() {
  const router = useRouter()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Clear any auth errors when the signin page mounts
  useEffect(() => {
    clearError()
  }, [clearError])

  // Clear validation errors when user starts typing
  useEffect(() => {
    setErrors({})
  }, [formData])

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      nextErrors.email = 'Please enter an email (can be any value).'
    }

    if (!formData.password.trim()) {
      nextErrors.password = 'Please enter a password (can be any value).'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    // Clear any previous errors before attempting login
    clearError()

    const result = await login(formData)

    // Check if result is a success response with requiresTwoFactor flag
    if (
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      result.success &&
      'data' in result &&
      result.data &&
      typeof result.data === 'object' &&
      'requiresTwoFactor' in result.data &&
      result.data.requiresTwoFactor === true &&
      'userId' in result.data &&
      'email' in result.data
    ) {
      // Redirect to 2FA verification page with userId and email in query params
      router.push(
        `/auth/verify-2fa?userId=${encodeURIComponent(result.data.userId as string)}&email=${encodeURIComponent(result.data.email as string)}`
      )
      return
    }

    // If result is true, login was successful
    if (result === true) {
      router.replace('/analytics-dashboard')
    }
  }

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    // Clear API error when user starts typing
    if (error) {
      clearError()
    }
    setFormData(prev => ({ ...prev, [field]: value }))
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
              <h1 className="text-2xl font-bold text-secondary-500">Welcome back</h1>
              <p className="text-sm text-gray-500">
                Sign-in to your booking system super-admin account
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onValueChange={value => handleInputChange('email', value)}
                isInvalid={!!errors.email}
                errorMessage={errors.email}
                variant="bordered"
                radius="lg"
                size="lg"
              />

              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={formData.password}
                onValueChange={value => handleInputChange('password', value)}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
                isInvalid={!!errors.password}
                errorMessage={errors.password}
                variant="bordered"
                radius="lg"
                size="lg"
              />

              <div className="flex justify-center text-sm">
                <Link href="/auth/forgot-password" className="text-gray-500 hover:text-gray-700">
                  Forgot password?
                </Link>
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
                {isLoading ? 'Authenticating…' : 'Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
