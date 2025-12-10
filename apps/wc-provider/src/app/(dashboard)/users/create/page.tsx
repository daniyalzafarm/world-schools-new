'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Card, CardBody } from '@heroui/react'
import { PageSlot } from '@/components/layout/page-slot'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { UserForm } from '@/components/users/user-form'
import { useUsersStore } from '@/stores/users-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { CreateUserData } from '@/types/users'

export default function CreateUserPage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { createUser, error, clearError } = useUsersStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect to 404 if user lacks permission
  useEffect(() => {
    if (!hasPermission('users.create')) {
      router.replace('/404')
    }
  }, [hasPermission, router])

  const handleSubmit = async (data: CreateUserData): Promise<boolean> => {
    setIsSubmitting(true)
    const success = await createUser(data)
    setIsSubmitting(false)

    if (success) {
      addToast({
        title: 'Success',
        description: 'User created successfully',
        color: 'success',
        timeout: 3000,
      })
      router.push('/users')
    }

    return success
  }

  const handleCancel = () => {
    clearError()
    router.push('/users')
  }

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Users', href: '/users' }, { label: 'Create New User' }]} />

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Add a new user to your team with specific role and permissions.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardBody className="p-6">
            <UserForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              storeError={error}
              isSubmitting={isSubmitting}
            />
          </CardBody>
        </Card>
      </div>
    </PageSlot>
  )
}
