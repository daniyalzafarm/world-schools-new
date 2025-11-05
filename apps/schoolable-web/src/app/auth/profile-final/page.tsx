'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@heroui/react'
import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { CityModal, type CitySuggestion } from '@/components/city-modal'
import { CITY_SUGGESTIONS } from '@/data/cities'
import { useAuthStore } from '@/stores/auth-store'
import { Search } from 'lucide-react'

export default function ProfileFinalPage() {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCityModal, setShowCityModal] = useState(false)

  const router = useRouter()
  const {
    register,
    updatePendingUser,
    pendingUser,
    isLoading,
    error,
    clearError,
    isAuthenticated,
  } = useAuthStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  // Load pending user data
  useEffect(() => {
    if (pendingUser.name) {
      setFormData(prev => ({ ...prev, name: pendingUser.name || '' }))
    }
    if (pendingUser.city) {
      setFormData(prev => ({ ...prev, city: pendingUser.city || '' }))
    }
  }, [pendingUser])

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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    // Update pending user with form data
    updatePendingUser({ name: formData.name, city: formData.city })

    const success = await register(
      pendingUser.email,
      pendingUser.password,
      formData.name,
      formData.city
    )

    if (success) {
      router.push('/')
    }
  }

  const handleClose = () => {
    setShowCityModal(false)
  }

  const handleSelectCity = (city: CitySuggestion) => {
    const cityName = city.name === 'Nearby' ? 'Los Angeles' : city.name
    setFormData(prev => ({ ...prev, city: cityName }))
    updatePendingUser({ city: cityName })
    setShowCityModal(false)
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
          <h1 className="text-3xl text-center font-bold mb-6">
            Just a few details to complete your account
          </h1>

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                aria-label="Name"
                placeholder="Your name"
                value={formData.name}
                onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
                isInvalid={!!errors.name}
                errorMessage={errors.name}
                variant="bordered"
                size="lg"
                classNames={{
                  input: 'text-gray-900',
                  inputWrapper:
                    'border border-gray-300 rounded-full px-6 bg-white hover:border-gray-400 focus-within:border-gray-900',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Where you live (optional)
              </label>
              <Button
                variant="bordered"
                size="lg"
                radius="full"
                className="w-full justify-between border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                onPress={() => setShowCityModal(true)}
                startContent={
                  <span className={formData.city ? 'text-gray-900' : 'text-gray-500'}>
                    {formData.city || 'Your city/town'}
                  </span>
                }
                endContent={<Search size={20} className="text-gray-400" />}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              radius="full"
              color="primary"
              className="w-full font-semibold"
              isLoading={isLoading}
              isDisabled={isLoading || !formData.name.trim()}
            >
              {isLoading ? 'Completing...' : 'Finish'}
            </Button>
          </form>
        </motion.div>
      </div>

      {/* City Selector Modal */}
      <CityModal
        isOpen={showCityModal}
        onClose={handleClose}
        onSelectCity={handleSelectCity}
        cities={CITY_SUGGESTIONS}
        placeholder="Search for a city..."
      />
    </div>
  )
}
