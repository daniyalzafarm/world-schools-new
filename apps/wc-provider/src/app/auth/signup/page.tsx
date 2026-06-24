'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Link, Progress } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input, PhoneInput, SelectField } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { signup } from '@/services/auth.services'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'
import { isValidPhoneNumber } from 'react-phone-number-input'

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
    jobTitle: '',
    customJobTitle: '', // For "Other" option
    phoneNumber: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Job title options
  const JOB_TITLE_OPTIONS = [
    'Owner / Director',
    'Camp Manager',
    'Administrator',
    'Marketing / Sales',
    'Other',
  ] as const

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

    if (!formData.jobTitle.trim()) {
      nextErrors.jobTitle = 'Job title is required'
    }
    // Custom job title is optional, no validation needed

    if (!formData.phoneNumber.trim()) {
      nextErrors.phoneNumber = 'Phone number is required'
    } else if (!isValidPhoneNumber(formData.phoneNumber)) {
      nextErrors.phoneNumber = 'Please enter a valid phone number'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    // Determine the final job title value
    const finalJobTitle =
      formData.jobTitle === 'Other' && formData.customJobTitle.trim()
        ? formData.customJobTitle.trim()
        : formData.jobTitle

    const response = await signup({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      jobTitle: finalJobTitle,
      phoneNumber: formData.phoneNumber,
    })

    if (response.success) {
      // Redirect to email verification page with email in query params
      router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`)
    } else {
      // Extract error message from API response
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
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-center">
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onValueChange={value => handleInputChange('firstName', value)}
                  isInvalid={!!errors.firstName}
                  errorMessage={errors.firstName}
                />

                <Input
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onValueChange={value => handleInputChange('lastName', value)}
                  isInvalid={!!errors.lastName}
                  errorMessage={errors.lastName}
                />
              </div>

              {/* Email & Phone Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={formData.email}
                  onValueChange={value => handleInputChange('email', value)}
                  isInvalid={!!errors.email}
                  errorMessage={errors.email}
                />

                <PhoneInput
                  value={formData.phoneNumber}
                  onChange={value => handleInputChange('phoneNumber', value || '')}
                  placeholder="Phone Number"
                  error={errors.phoneNumber}
                  className="phone-input-signup"
                />
              </div>

              {/* Job Title & Custom Job Title */}
              <div className={formData.jobTitle === 'Other' ? 'grid gap-4 md:grid-cols-2' : ''}>
                <div className="flex flex-col gap-2">
                  <SelectField
                    aria-label="Job Title"
                    placeholder="Select Job Title"
                    value={formData.jobTitle}
                    onChange={value => {
                      handleInputChange('jobTitle', value)
                      // Clear custom job title when switching away from "Other"
                      if (value !== 'Other') {
                        handleInputChange('customJobTitle', '')
                      }
                    }}
                    options={JOB_TITLE_OPTIONS}
                    isRequired
                    disallowEmptySelection
                  />
                  {errors.jobTitle && (
                    <span className="text-xs text-danger">{errors.jobTitle}</span>
                  )}
                </div>

                {/* Show custom job title input when "Other" is selected */}
                {formData.jobTitle === 'Other' && (
                  <Input
                    aria-label="Other Job Title"
                    type="text"
                    placeholder="Please specify your job title"
                    value={formData.customJobTitle}
                    onValueChange={value => handleInputChange('customJobTitle', value)}
                  />
                )}
              </div>

              <div className="flex flex-col gap-4">
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
                  />
                </div>

                {formData.password && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
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
                  className="text-secondary-500 hover:text-secondary-600 font-medium"
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
