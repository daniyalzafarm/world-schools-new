'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Link, Progress } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { signup } from '@/services/auth.services'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'

export default function SignUpPage() {
  const router = useRouter()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    providerName: '',
    providerPhone: '',
    providerEmail: '',
    website: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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

    if (!formData.providerName.trim()) {
      nextErrors.providerName = 'Organization name is required'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await signup({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        providerName: formData.providerName,
        providerPhone: formData.providerPhone || undefined,
        providerEmail: formData.providerEmail || undefined,
        website: formData.website || undefined,
      })

      if (response.success) {
        // Redirect to email verification page with email in query params
        router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold text-secondary-500">Create your account</h1>
              <p className="text-sm text-gray-500">
                Register your organization to start managing camps and bookings
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onValueChange={value => handleInputChange('firstName', value)}
                  isInvalid={!!errors.firstName}
                  errorMessage={errors.firstName}
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
                  variant="bordered"
                  radius="lg"
                  size="lg"
                />
              </div>

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

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
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
                        color={getPasswordStrengthHeroColor(
                          validatePassword(formData.password).strength
                        )}
                        size="sm"
                        aria-label="Password strength"
                      />
                    </div>
                    <PasswordRequirementsDisplay password={formData.password} />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-4">Organization Details</p>

                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Organization name"
                    value={formData.providerName}
                    onValueChange={value => handleInputChange('providerName', value)}
                    isInvalid={!!errors.providerName}
                    errorMessage={errors.providerName}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="email"
                      placeholder="Organization email (optional)"
                      value={formData.providerEmail}
                      onValueChange={value => handleInputChange('providerEmail', value)}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                    />

                    <Input
                      type="tel"
                      placeholder="Organization phone (optional)"
                      value={formData.providerPhone}
                      onValueChange={value => handleInputChange('providerPhone', value)}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                    />
                  </div>

                  <Input
                    type="url"
                    placeholder="Website (optional)"
                    value={formData.website}
                    onValueChange={value => handleInputChange('website', value)}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                  />
                </div>
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
                {isLoading ? 'Creating account…' : 'Create account'}
              </Button>

              <div className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link
                  href="/auth/signin"
                  className="text-primary-500 hover:text-primary-600 font-medium"
                >
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
