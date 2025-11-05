'use client'

import React, { useState } from 'react'
import { Accordion, AccordionItem, Button } from '@heroui/react'
import { ChevronLeft, LogOut } from 'lucide-react'

import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@world-schools/ui-web'

const AdminProfilePage = () => {
  const { user, logout } = useAuthStore()

  const [formData, setFormData] = useState({
    fullName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Admin User',
    email: user?.email || 'admin@schoolableproviders.com',
  })
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsFormDirty(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setIsFormDirty(false)
  }

  return (
    <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
        <div className="h-20 px-10 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile Settings</h1>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Accordion selectionMode="multiple" defaultExpandedKeys={['profile']} className="space-y-6">
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

          <AccordionItem
            key="account"
            title="Account Management"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Logout from your account
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button
                  color="primary"
                  radius="full"
                  className="w-32"
                  startContent={<LogOut size={20} />}
                  onPress={() => logout()}
                >
                  Logout
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Delete admin account
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permanently delete your admin account and all associated data
                  </p>
                </div>
                <Button color="danger" variant="bordered" radius="full" className="w-32">
                  Delete Account
                </Button>
              </div>
            </div>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

export default AdminProfilePage
