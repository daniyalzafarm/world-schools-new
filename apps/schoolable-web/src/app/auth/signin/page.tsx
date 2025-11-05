'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Input, Link } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const router = useRouter()
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  // Clear errors when form data changes
  useEffect(() => {
    if (error) {
      clearError()
    }
    setErrors({})
  }, [formData, error, clearError])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const success = await login(formData)
    if (success) {
      router.push('/')
    }
  }

  const handleGoogleSignIn = () => {
    // TODO: Implement Google Sign-In
    // console.warn('Google Sign-In clicked')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with Logo */}
      <div className="py-3 px-4">
        <Logo size="lg" showText={false} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-18">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full border-0 max-w-md bg-white rounded-lg p-8"
        >
          {/* Header */}
          <h1 className="text-3xl text-center font-bold text-gray-900 mb-6">Welcome back</h1>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              aria-label="Email address"
              placeholder="Email address"
              value={formData.email}
              onValueChange={value => setFormData(prev => ({ ...prev, email: value }))}
              isInvalid={!!errors.email}
              errorMessage={errors.email}
              variant="bordered"
              size="lg"
              classNames={{
                input: 'text-gray-900',
                inputWrapper:
                  'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
              }}
            />

            <Input
              type={showPassword ? 'text' : 'password'}
              aria-label="Password"
              placeholder="Password"
              value={formData.password}
              onValueChange={value => setFormData(prev => ({ ...prev, password: value }))}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
              isInvalid={!!errors.password}
              errorMessage={errors.password}
              variant="bordered"
              size="lg"
              classNames={{
                input: 'text-gray-900',
                inputWrapper:
                  'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
              }}
            />

            <div className="flex justify-center">
              <Link
                href="/auth/forgot-password"
                size="sm"
                className="font-semibold text-primary-dark underline hover:text-primary-dark-700"
              >
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
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-primary-dark">
              Don't have an account?{' '}
              <Link
                href="/auth/signup"
                className="font-semibold text-primary-dark underline hover:text-primary-dark-700"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Google Sign-In */}
          <Button
            variant="bordered"
            size="lg"
            radius="full"
            className="w-full border mt-6 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            startContent={<FcGoogle className="w-5 h-5" />}
            onPress={handleGoogleSignIn}
          >
            Continue with Google
          </Button>

          {/* Terms */}
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              By proceeding, you agree to our{' '}
              <Link href="/terms-of-service" size="sm" className="text-gray-900 text-xs underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" size="sm" className="text-gray-900 text-xs underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/cookie-policy" size="sm" className="text-gray-900 text-xs underline">
                Cookie Policy
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
