'use client'

import React, { useState } from 'react'
import { Accordion, AccordionItem, Button, Progress } from '@heroui/react'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'

import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@world-schools/ui-web'
import { ProtectedRoute } from '@/components/auth/protected-route'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'

const ProfilePage = () => {
  const { user, changePassword, error, clearError } = useAuthStore()

  // Form state
  const [formData, setFormData] = useState({
    fullName: user?.firstName ? `${user.firstName} ${user.lastName}`.trim() : 'Superadmin',
    email: user?.email || 'superadmin@worldcamps.com',
  })
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Password reset state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isPasswordDirty, setIsPasswordDirty] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Password visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsFormDirty(true)
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
    setIsPasswordDirty(true)
    // Clear errors when user starts typing
    if (passwordError) {
      setPasswordError(null)
    }
    if (passwordSuccess) {
      setPasswordSuccess(false)
    }
    if (error) {
      clearError()
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setIsFormDirty(false)
    // Here you would typically call an API to save the data
  }

  const handlePasswordReset = async () => {
    // Clear previous messages
    setPasswordError(null)
    setPasswordSuccess(false)
    clearError()

    // Validate password strength
    const passwordValidation = validatePassword(passwordData.newPassword)
    if (!passwordValidation.isValid) {
      setPasswordError('Password does not meet all requirements')
      return
    }

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords don't match")
      return
    }

    setIsPasswordSaving(true)

    try {
      // Call the changePassword API with the correct payload
      const success = await changePassword({
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      if (success) {
        setPasswordSuccess(true)
        setIsPasswordDirty(false)
        // Clear password fields after successful reset
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        // Clear success message after 5 seconds
        setTimeout(() => {
          setPasswordSuccess(false)
        }, 5000)
      } else {
        // The error is now set in the auth store by changePassword
        // We need to read it after the state update
        setTimeout(() => {
          const currentError = useAuthStore.getState().error
          if (currentError) {
            setPasswordError(currentError)
            clearError() // Clear from auth store after copying to local state
          } else {
            setPasswordError('Failed to change password. Please check your current password.')
          }
        }, 0)
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const isPasswordValid =
    passwordData.currentPassword &&
    passwordData.newPassword &&
    passwordData.confirmPassword &&
    passwordData.newPassword === passwordData.confirmPassword

  return (
    <ProtectedRoute requireAuth={true} requireSuperAdmin={true}>
      <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
        {/* Sticky Page Header */}
        <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
          <div className="h-20 px-10 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Profile Settings
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <Accordion
            selectionMode="multiple"
            defaultExpandedKeys={['profile', 'password']}
            className="space-y-6"
          >
            {/* Profile Section */}
            <AccordionItem
              key="profile"
              title="Basic Information"
              classNames={{
                base: 'bg-transparent',
                title: 'text-2xl font-semibold',
                subtitle: 'text-secondary',
                trigger: 'py-0 cursor-pointer',
                content: 'pt-6',
              }}
              indicator={<ChevronLeft size={24} className="text-secondary" />}
            >
              <div className="space-y-6">
                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Full Name"
                    labelPlacement="outside"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onValueChange={value => handleInputChange('fullName', value)}
                    variant="bordered"
                  />
                  <Input
                    label="Email"
                    type="email"
                    labelPlacement="outside"
                    placeholder="Enter your email"
                    value={formData.email}
                    onValueChange={value => handleInputChange('email', value)}
                    variant="bordered"
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    color="primary"
                    radius="full"
                    size="lg"
                    onPress={handleSave}
                    isLoading={isSaving}
                    disabled={!isFormDirty || isSaving}
                    className="px-8"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </AccordionItem>

            {/* Password Reset Section */}
            <AccordionItem
              key="password"
              title="Reset Password"
              classNames={{
                base: 'bg-transparent',
                title: 'text-2xl font-semibold',
                subtitle: 'text-secondary',
                trigger: 'py-0 cursor-pointer',
                content: 'pt-6',
              }}
              indicator={<ChevronLeft size={24} className="text-secondary" />}
            >
              <div className="space-y-6">
                {/* Success Message */}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">
                    Password changed successfully!
                  </div>
                )}

                {/* Error Message */}
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {passwordError}
                  </div>
                )}

                {/* Password Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Current Password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    labelPlacement="outside"
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onValueChange={value => handlePasswordChange('currentPassword', value)}
                    variant="bordered"
                    endContent={
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(prev => !prev)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    }
                  />
                  <div></div>
                  <div className="space-y-4">
                    <Input
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      labelPlacement="outside"
                      placeholder="Enter new password"
                      value={passwordData.newPassword}
                      onValueChange={value => handlePasswordChange('newPassword', value)}
                      variant="bordered"
                      endContent={
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(prev => !prev)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      }
                    />

                    {passwordData.newPassword && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Password strength:</span>
                            <span className="font-medium text-gray-700">
                              {getPasswordStrengthLabel(
                                validatePassword(passwordData.newPassword).strength
                              )}
                            </span>
                          </div>
                          <Progress
                            value={validatePassword(passwordData.newPassword).strength}
                            color={getPasswordStrengthHeroColor(
                              validatePassword(passwordData.newPassword).strength
                            )}
                            size="sm"
                            aria-label="Password strength"
                          />
                        </div>
                        <PasswordRequirementsDisplay password={passwordData.newPassword} />
                      </div>
                    )}
                  </div>
                  <Input
                    label="Confirm New Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    labelPlacement="outside"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onValueChange={value => handlePasswordChange('confirmPassword', value)}
                    variant="bordered"
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
                    isInvalid={
                      !!passwordData.confirmPassword &&
                      passwordData.newPassword !== passwordData.confirmPassword
                    }
                    errorMessage={
                      passwordData.confirmPassword &&
                      passwordData.newPassword !== passwordData.confirmPassword
                        ? "Passwords don't match"
                        : undefined
                    }
                  />
                </div>

                {/* Reset Password Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    color="primary"
                    radius="full"
                    size="lg"
                    onPress={handlePasswordReset}
                    isLoading={isPasswordSaving}
                    disabled={!isPasswordDirty || !isPasswordValid || isPasswordSaving}
                    className="px-8"
                  >
                    {isPasswordSaving ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default ProfilePage
