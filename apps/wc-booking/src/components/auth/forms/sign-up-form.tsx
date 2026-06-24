'use client'

import React, { useEffect, useState } from 'react'
import { Button, Progress } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'
import { signup } from '@/services/auth.services'
import { AuthFormShell } from '@/components/auth/forms/auth-form-shell'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'

interface SignUpFormProps {
  onSuccess: (email: string) => void
  /** Fired when Google sign-up fully authenticates (no email verification needed). */
  onGoogleSuccess: () => void
  onSignIn: () => void
}

export function SignUpForm({ onSuccess, onGoogleSuccess, onSignIn }: SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Disable the form while a sign-up (email or Google) is in flight.
  const isBusy = isLoading || googleLoading

  // Clear validation errors when user starts typing
  useEffect(() => {
    setErrors({})
    setError(null)
  }, [formData])

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password.trim()) {
      nextErrors.password = 'Password is required'
    } else {
      const passwordValidation = validatePassword(formData.password)
      if (!passwordValidation.isValid) {
        nextErrors.password = 'Password does not meet all requirements'
      }
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.firstName.trim()) {
      nextErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      nextErrors.lastName = 'Last name is required'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    const response = await signup({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
    })

    if (response.success) {
      onSuccess(formData.email)
    } else {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Registration failed. Please try again.'
      setError(errorMessage)
    }

    setIsLoading(false)
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <AuthFormShell
      title="Create your account"
      description="Join World Camps to discover and book amazing camp experiences for your children"
      onSubmit={handleSubmit}
      footer={
        <div className="mx-auto flex w-full max-w-100 flex-col gap-3">
          <Button
            type="submit"
            radius="full"
            color="primary"
            isLoading={isLoading}
            isDisabled={isBusy}
          >
            {isLoading ? 'Creating account…' : 'Create account'}
          </Button>

          <GoogleAuthButton onSuccess={onGoogleSuccess} onLoadingChange={setGoogleLoading} />

          <div className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              disabled={isBusy}
              className="text-secondary-500 hover:text-secondary-600 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign in
            </button>
          </div>
        </div>
      }
    >
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="text"
            placeholder="First name"
            value={formData.firstName}
            onValueChange={value => handleInputChange('firstName', value)}
            isInvalid={!!errors.firstName}
            errorMessage={errors.firstName}
            isDisabled={isBusy}
            variant="bordered"
            radius="lg"
            size="lg"
          />

          <Input
            type="text"
            placeholder="Last name"
            value={formData.lastName}
            onValueChange={value => handleInputChange('lastName', value)}
            isInvalid={!!errors.lastName}
            errorMessage={errors.lastName}
            isDisabled={isBusy}
            variant="bordered"
            radius="lg"
            size="lg"
          />
        </div>

        <Input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={formData.email}
          onValueChange={value => handleInputChange('email', value)}
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          isDisabled={isBusy}
          variant="bordered"
          radius="lg"
          size="lg"
        />

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
              isDisabled={isBusy}
              variant="bordered"
              radius="lg"
              size="lg"
            />

            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onValueChange={value => handleInputChange('confirmPassword', value)}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
              isInvalid={!!errors.confirmPassword}
              errorMessage={errors.confirmPassword}
              isDisabled={isBusy}
              variant="bordered"
              radius="lg"
              size="lg"
            />
          </div>

          {formData.password && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Password strength:</span>
                  <span className="font-medium text-gray-700">
                    {getPasswordStrengthLabel(validatePassword(formData.password).strength)}
                  </span>
                </div>
                <Progress
                  value={validatePassword(formData.password).strength}
                  color={getPasswordStrengthHeroColor(validatePassword(formData.password).strength)}
                  size="sm"
                  aria-label="Password strength"
                />
              </div>
              <PasswordRequirementsDisplay password={formData.password} />
            </div>
          )}
        </div>
      </div>
    </AuthFormShell>
  )
}
