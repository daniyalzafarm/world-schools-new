'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Link } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

export default function SignInPage() {
  const router = useRouter()
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/analytics-dashboard')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    if (error) {
      clearError()
    }
    setErrors({})
  }, [formData, error, clearError])

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

    const success = await login(formData)
    if (success) {
      router.replace('/analytics-dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      <header className="py-6 px-6">
        <Logo size="lg" />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-18">
        <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur rounded-3xl shadow-xl p-10 space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Superadmin Console</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Sign in to review provider applications, monitor activity, and manage your teams.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="Work email"
              labelPlacement="outside"
              placeholder="you@worldcamps.org"
              value={formData.email}
              onValueChange={value => setFormData(prev => ({ ...prev, email: value }))}
              isInvalid={!!errors.email}
              errorMessage={errors.email}
              variant="bordered"
              radius="full"
              size="lg"
              classNames={{
                inputWrapper:
                  'border border-slate-200 bg-white hover:border-primary focus-within:border-primary shadow-sm',
              }}
            />

            <Input
              type={showPassword ? 'text' : 'password'}
              label="Password"
              labelPlacement="outside"
              placeholder="Enter your password"
              value={formData.password}
              onValueChange={value => setFormData(prev => ({ ...prev, password: value }))}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
              isInvalid={!!errors.password}
              errorMessage={errors.password}
              variant="bordered"
              radius="full"
              size="lg"
              classNames={{
                inputWrapper:
                  'border border-slate-200 bg-white hover:border-primary focus-within:border-primary shadow-sm',
              }}
            />

            <div className="flex justify-between text-sm">
              <Link
                href="/auth/forgot-password"
                className="font-semibold text-primary hover:text-primary-700"
              >
                Forgot password?
              </Link>
              <span className="text-slate-500">Support: superadmin@worldcamps.org</span>
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
      </main>
    </div>
  )
}
