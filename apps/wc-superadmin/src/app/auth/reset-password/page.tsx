'use client'

import React, { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'

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

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.newPassword.trim()) {
      nextErrors.newPassword = 'Please enter a new password.'
    } else if (formData.newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters long.'
    }

    if (!formData.confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your password.'
    } else if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)

    // Redirect to sign in page after successful reset
    router.push('/auth/signin?reset=success')
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
              <h1 className="text-2xl font-bold text-secondary-500">Reset password</h1>
              <p className="text-sm text-gray-500">Enter your new password</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password"
                value={formData.newPassword}
                onValueChange={value => setFormData(prev => ({ ...prev, newPassword: value }))}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
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

              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm New Password"
                value={formData.confirmPassword}
                onValueChange={value => setFormData(prev => ({ ...prev, confirmPassword: value }))}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
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
