'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Progress } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { resetPassword } from '@/services/auth.services'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Clear validation errors when user starts typing
  useEffect(() => {
    setErrors({})
  }, [formData])

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.newPassword.trim()) {
      nextErrors.newPassword = 'Please enter a new password.'
    } else {
      const passwordValidation = validatePassword(formData.newPassword)
      if (!passwordValidation.isValid) {
        nextErrors.newPassword = 'Password does not meet all requirements'
      }
    }

    if (!formData.confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your password.'
    } else if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleInputChange = (field: 'newPassword' | 'confirmPassword', value: string) => {
    // Clear API error when user starts typing
    if (error) {
      setError(null)
    }
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    if (!token) {
      setError('Invalid or missing reset token')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await resetPassword({ token, newPassword: formData.newPassword })
      setSuccess(true)
      // Redirect to signin after 2 seconds
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)
    } catch (err: any) {
      console.error('Reset password error:', err)
      const errorMessage =
        err?.response?.data?.message || 'Failed to reset password. Please try again.'
      setError(errorMessage)
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
            {success ? (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-bold text-secondary-500">
                    Password reset successful!
                  </h1>
                  <p className="text-sm text-gray-500">You can now login with your new password.</p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600 text-center">
                  Redirecting to sign in page...
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-bold text-secondary-500">Reset password</h1>
                  <p className="text-sm text-gray-500">Enter your new password</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="New Password"
                      value={formData.newPassword}
                      onValueChange={value => handleInputChange('newPassword', value)}
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
                      isInvalid={!!errors.newPassword}
                      errorMessage={errors.newPassword}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                    />

                    {formData.newPassword && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Password strength:</span>
                            <span className="font-medium text-gray-700">
                              {getPasswordStrengthLabel(
                                validatePassword(formData.newPassword).strength
                              )}
                            </span>
                          </div>
                          <Progress
                            value={validatePassword(formData.newPassword).strength}
                            color={getPasswordStrengthHeroColor(
                              validatePassword(formData.newPassword).strength
                            )}
                            size="sm"
                            aria-label="Password strength"
                          />
                        </div>
                        <PasswordRequirementsDisplay password={formData.newPassword} />
                      </div>
                    )}
                  </div>

                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm New Password"
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

                  <Button
                    type="submit"
                    size="lg"
                    radius="full"
                    color="primary"
                    className="w-full font-semibold"
                    isLoading={isLoading}
                    isDisabled={isLoading}
                  >
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
