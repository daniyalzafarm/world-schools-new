'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { useAuthStore } from '@/stores/auth-store'
import { AuthFormShell } from '@/components/auth/forms/auth-form-shell'

interface SignInFormProps {
  /** Optional heading override (e.g. "Log in to book"). Defaults to "Welcome back". */
  title?: string
  onSuccess: () => void
  onRequiresTwoFactor: (userId: string, email: string) => void
  onEmailNotVerified: (email: string) => void
  onForgotPassword: () => void
  onSignUp: () => void
}

export function SignInForm({
  title,
  onSuccess,
  onRequiresTwoFactor,
  onEmailNotVerified,
  onForgotPassword,
  onSignUp,
}: SignInFormProps) {
  const { login, isLoading, error, clearError } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Clear any auth errors when the form mounts
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

    clearError()

    const result = await login(formData)

    // Login succeeded but 2FA is required
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
      onRequiresTwoFactor(result.data.userId as string, result.data.email as string)
      return
    }

    // Login failed because the email is not yet verified
    if (
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      !result.success &&
      'data' in result &&
      result.data &&
      typeof result.data === 'object' &&
      'emailNotVerified' in result.data &&
      result.data.emailNotVerified === true &&
      'email' in result.data
    ) {
      onEmailNotVerified(result.data.email as string)
      return
    }

    if (result === true) {
      onSuccess()
    }
  }

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    if (error) clearError()
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <AuthFormShell
      title={title ?? 'Welcome back'}
      description={title ? undefined : 'Sign in to your account'}
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
            {isLoading ? 'Authenticating…' : 'Sign in'}
          </Button>

          <div className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={onSignUp}
              className="text-secondary-500 hover:text-secondary-600 font-medium cursor-pointer"
            >
              Sign up
            </button>
          </div>
        </>
      }
    >
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="space-y-5">
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
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </AuthFormShell>
  )
}
