'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Card, CardBody, Input } from '@heroui/react'
import { MapPin, User } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

export default function OnboardingPage() {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const router = useRouter()
  const { completeOnboarding, isLoading, error, clearError, isAuthenticated, user } = useAuthStore()

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin')
    }
  }, [isAuthenticated, router])

  // Pre-fill name if available from user data
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: `${user.firstName} ${user.lastName}`.trim(),
      }))
    }
  }, [user])

  // Clear errors when form data changes
  useEffect(() => {
    if (error) {
      clearError()
    }
    setErrors({})
  }, [formData, error, clearError])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const success = await completeOnboarding({
      name: formData.name.trim(),
      location: formData.location.trim(),
    })

    if (success) {
      router.push('/')
    }
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0">
          <CardBody className="p-8">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <Logo size="lg" showText={true} />
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome!</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Just a few details to complete your account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg"
              >
                <p className="text-danger-600 dark:text-danger-400 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                type="text"
                label="Your Name"
                placeholder="Enter your full name"
                value={formData.name}
                onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
                startContent={<User size={20} className="text-gray-400" />}
                isInvalid={!!errors.name}
                errorMessage={errors.name}
                variant="bordered"
                size="lg"
              />

              <Input
                type="text"
                label="Where do you live? (city/town)"
                placeholder="Enter your city or town"
                value={formData.location}
                onValueChange={value => setFormData(prev => ({ ...prev, location: value }))}
                startContent={<MapPin size={20} className="text-gray-400" />}
                isInvalid={!!errors.location}
                errorMessage={errors.location}
                variant="bordered"
                size="lg"
              />

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="w-full font-semibold"
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                {isLoading ? 'Setting up...' : 'Finish'}
              </Button>
            </form>

            {/* Additional Info */}
            <div className="text-center mt-6">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This information helps us personalize your experience and connect you with relevant
                educational opportunities in your area.
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}
