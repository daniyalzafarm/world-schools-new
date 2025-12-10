'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addToast, Card, CardBody } from '@heroui/react'
import { PageSlot } from '@/components/layout/page-slot'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { UserForm } from '@/components/users/user-form'
import { useUsersStore } from '@/stores/users-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { CreateUserData, UpdateUserData } from '@/types/users'

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  const { hasPermission } = usePermissions()

  const { users, fetchUsers, updateUser, error, clearError, isLoading } = useUsersStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const user = users.find(u => u.id === userId)

  // Redirect to 404 if user lacks permission
  useEffect(() => {
    if (!hasPermission('users.update')) {
      router.replace('/404')
    }
  }, [hasPermission, router])

  useEffect(() => {
    if (users.length === 0) {
      void fetchUsers()
    }
  }, [users.length, fetchUsers])

  const handleSubmit = async (data: CreateUserData): Promise<boolean> => {
    setIsSubmitting(true)

    // Convert CreateUserData to UpdateUserData
    const updateData: UpdateUserData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      roleIds: data.roleIds,
    }

    // Only include password if it's provided
    if (data.password) {
      updateData.password = data.password
    }

    const success = await updateUser(userId, updateData)
    setIsSubmitting(false)

    if (success) {
      addToast({
        title: 'Success',
        description: 'User updated successfully',
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

  // Show loading state while fetching user data
  if (isLoading || !user) {
    return (
      <PageSlot>
        <div className="space-y-6">
          <Breadcrumb items={[{ label: 'Users', href: '/users' }, { label: 'Edit User' }]} />
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Loading user data...</p>
          </div>
        </div>
      </PageSlot>
    )
  }

  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: 'Users', href: '/users' }, { label: `Edit User: "${userName}"` }]}
        />

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit User</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Update the user information and role for "{userName}".
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardBody className="p-6">
            <UserForm
              user={user}
              isEdit={true}
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
