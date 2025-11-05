'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Checkbox, Input, Link, Progress } from '@heroui/react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: pwd => pwd.length >= 8 },
  { label: 'At least one uppercase letter', test: pwd => /[A-Z]/.test(pwd) },
  { label: 'At least one lowercase letter', test: pwd => /[a-z]/.test(pwd) },
  { label: 'At least one number', test: pwd => /\d/.test(pwd) },
  { label: 'At least one special character', test: pwd => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) },
]

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    subscribeToUpdates: true,
    agreeToTerms: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passwordStrength, setPasswordStrength] = useState(0)

  const router = useRouter()
  const { signUp, isLoading, error, clearError, isAuthenticated } = useAuthStore()

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

  // Calculate password strength
  useEffect(() => {
    const metRequirements = passwordRequirements.filter(req => req.test(formData.password)).length
    setPasswordStrength((metRequirements / passwordRequirements.length) * 100)
  }, [formData.password])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else {
      const unmetRequirements = passwordRequirements.filter(req => !req.test(formData.password))
      if (unmetRequirements.length > 0) {
        newErrors.password = 'Password does not meet all requirements'
      }
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the Terms of Service'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const success = await signUp(formData.email, formData.password)

    if (success) {
      router.push('/auth/profile-final')
    }
  }

  const handleGoogleSignUp = () => {
    // TODO: Implement Google Sign-Up
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return 'danger'
    if (passwordStrength < 80) return 'warning'
    return 'success'
  }

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 40) return 'Weak'
    if (passwordStrength < 80) return 'Medium'
    return 'Strong'
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
          <h1 className="text-3xl text-center font-bold mb-6">Join Schoolable</h1>

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

            <div className="space-y-3">
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

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Password strength:</span>
                    <span className={`text-sm font-medium text-${getPasswordStrengthColor()}-600`}>
                      {getPasswordStrengthLabel()}
                    </span>
                  </div>
                  <Progress
                    value={passwordStrength}
                    color={getPasswordStrengthColor()}
                    size="sm"
                    className="w-full"
                  />
                </div>
              )}

              {/* Password Requirements */}
              {formData.password && (
                <div className="space-y-1">
                  {passwordRequirements.map((requirement, index) => {
                    const isMet = requirement.test(formData.password)
                    return (
                      <div key={index} className="flex items-center gap-2">
                        {isMet ? (
                          <Check size={16} className="text-success-600" />
                        ) : (
                          <X size={16} className="text-danger-600" />
                        )}
                        <span className={`text-sm ${isMet ? 'text-success-600' : 'text-gray-500'}`}>
                          {requirement.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Subscribe to Updates Checkbox */}
            <Checkbox
              isSelected={formData.subscribeToUpdates}
              onValueChange={checked =>
                setFormData(prev => ({ ...prev, subscribeToUpdates: checked }))
              }
              size="md"
              classNames={{
                wrapper: 'mt-1',
                label: 'text-sm text-gray-600 leading-relaxed',
              }}
            >
              Yes, I'd like to receive updates, offers, and helpful tips. I can unsubscribe anytime.
            </Checkbox>

            {/* Legal Text */}
            <div className="mt-4 text-xs text-gray-500 leading-relaxed">
              By signing up, you agree to our{' '}
              <Link href="/terms-of-service" size="sm" className="text-xs text-gray-900 underline">
                Terms of Service
              </Link>{' '}
              and confirm you've read and understood our{' '}
              <Link href="/privacy-policy" size="sm" className="text-xs text-gray-900 underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/cookie-policy" size="sm" className="text-xs text-gray-900 underline">
                Cookie Policy
              </Link>
              . We collect and process your data to provide personalized recommendations and
              facilitate secure communication with schools and camps. You can access, update, or
              delete your information at any time in your account settings.
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
              {isLoading ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>

          {/* Sign In Link */}
          <div className="text-center mt-6">
            <p className="text-primary-dark">
              Have an account?{' '}
              <Link
                href="/auth/signin"
                className="font-semibold text-primary-dark underline hover:text-gray-700"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Google Sign-Up */}
          <Button
            variant="bordered"
            size="lg"
            radius="full"
            className="w-full border mt-6 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            startContent={<FcGoogle className="w-5 h-5" />}
            onPress={handleGoogleSignUp}
          >
            Continue with Google
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
