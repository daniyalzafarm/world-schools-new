'use client'

import React, { useState } from 'react'
import { Accordion, AccordionItem, Button } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'

import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@world-schools/ui-web'
import { ProtectedRoute } from '@/components/auth/protected-route'

const SettingsPage = () => {
  const { user } = useAuthStore()

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsFormDirty(true)
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
    setIsPasswordDirty(true)
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
    setIsPasswordSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsPasswordSaving(false)
    setIsPasswordDirty(false)
    // Clear password fields after successful reset
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    // Here you would typically call an API to reset the password
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
                {/* Password Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Current Password"
                    type="password"
                    labelPlacement="outside"
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onValueChange={value => handlePasswordChange('currentPassword', value)}
                    variant="bordered"
                  />
                  <div></div>
                  <Input
                    label="New Password"
                    type="password"
                    labelPlacement="outside"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onValueChange={value => handlePasswordChange('newPassword', value)}
                    variant="bordered"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    labelPlacement="outside"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onValueChange={value => handlePasswordChange('confirmPassword', value)}
                    variant="bordered"
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
                    {isPasswordSaving ? 'Resetting...' : 'Reset Password'}
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

export default SettingsPage

