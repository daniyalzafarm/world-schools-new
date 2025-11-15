'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Link } from '@heroui/react'
import { InputOtp } from '@heroui/input-otp'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'

type ForgotPasswordStep = 'email' | 'otp' | 'newPassword'

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

export default function ForgotPasswordPage() {
  const [currentStep, setCurrentStep] = useState<ForgotPasswordStep>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const router = useRouter()

  // Timer for resend code functionality
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [resendTimer])

  const isValidEmail = (val: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(val)
  const isValidOtp = otp.length === 6
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const canProceedFromEmail = isValidEmail(email)
  const canProceedFromOtp = isValidOtp
  const canProceedFromPassword =
    passwordRequirements.every(req => req.test(newPassword)) && passwordsMatch

  const handleSendOtp = async () => {
    setLoading(true)
    setError('')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentStep('otp')
      setResendTimer(30) // Start 30 second timer
    } catch {
      setError('Failed to send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setError('')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Clear OTP field
      setOtp('')
      setResendTimer(30) // Start 30 second timer
    } catch {
      setError('Failed to resend verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    setError('')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentStep('newPassword')
    } catch {
      setError('Invalid verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setError('')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      router.push('/auth/signin')
    } catch {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (value?: string) => {
    setOtp(value || '')
  }

  const handleOtpComplete = (value?: string) => {
    setOtp(value || '')
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'email':
        return 'Reset your password'
      case 'otp':
        return 'Enter verification code'
      case 'newPassword':
        return 'Create new password'
    }
  }

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 'email':
        return "Enter your email address and we'll send you a verification code."
      case 'otp':
        return `We've sent a 6-digit code to ${email}`
      case 'newPassword':
        return 'Your new password must meet the requirements below.'
    }
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
          <h1 className="text-3xl text-center font-bold mb-6">{getStepTitle()}</h1>
          <p className="text-center text-gray-600 mb-6">{getStepSubtitle()}</p>

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

          {/* Email Step */}
          {currentStep === 'email' && (
            <div className="space-y-6">
              <Input
                type="email"
                aria-label="Email address"
                placeholder="Email address"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
                size="lg"
                classNames={{
                  input: 'text-gray-900',
                  inputWrapper:
                    'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
                }}
              />

              <Button
                size="lg"
                radius="full"
                color="primary"
                className="w-full font-semibold"
                isLoading={loading}
                isDisabled={loading || !canProceedFromEmail}
                onPress={handleSendOtp}
              >
                {loading ? 'Sending...' : 'Send verification code'}
              </Button>
            </div>
          )}

          {/* OTP Step */}
          {currentStep === 'otp' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOtp
                  label="Verification code"
                  value={otp}
                  onValueChange={handleOtpChange}
                  onComplete={handleOtpComplete}
                  length={6}
                  variant="bordered"
                  size="lg"
                  color="primary"
                  radius="md"
                  classNames={{
                    base: 'gap-2',
                    input: 'text-center text-lg font-bold',
                  }}
                />
              </div>

              <div className="text-center">
                <Button
                  variant="light"
                  size="sm"
                  onPress={handleResendOtp}
                  isDisabled={resendTimer > 0}
                  className="text-primary-dark hover:text-gray-700"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                </Button>
              </div>

              <Button
                size="lg"
                radius="full"
                color="primary"
                className="w-full font-semibold"
                isLoading={loading}
                isDisabled={loading || !canProceedFromOtp}
                onPress={handleVerifyOtp}
              >
                {loading ? 'Verifying...' : 'Verify code'}
              </Button>
            </div>
          )}

          {/* New Password Step */}
          {currentStep === 'newPassword' && (
            <div className="space-y-6">
              <Input
                type={showPassword ? 'text' : 'password'}
                aria-label="New password"
                placeholder="New password"
                value={newPassword}
                onValueChange={setNewPassword}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
                variant="bordered"
                size="lg"
                classNames={{
                  input: 'text-gray-900',
                  inputWrapper:
                    'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
                }}
              />

              {/* Password Requirements */}
              {newPassword && (
                <div className="space-y-1">
                  {passwordRequirements.map((requirement, index) => {
                    const isMet = requirement.test(newPassword)
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

              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                aria-label="Confirm password"
                placeholder="Confirm password"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
                variant="bordered"
                size="lg"
                isInvalid={confirmPassword.length > 0 && !passwordsMatch}
                errorMessage={
                  confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : ''
                }
                classNames={{
                  input: 'text-gray-900',
                  inputWrapper:
                    'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
                }}
              />

              <Button
                size="lg"
                radius="full"
                color="primary"
                className="w-full font-semibold"
                isLoading={loading}
                isDisabled={loading || !canProceedFromPassword}
                onPress={handleResetPassword}
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
            </div>
          )}

          {/* Back to Sign In */}
          <div className="text-center mt-6">
            <Link
              href="/auth/signin"
              className="font-semibold text-primary-dark hover:text-gray-700"
            >
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
