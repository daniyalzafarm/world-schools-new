'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Card, CardBody } from '@heroui/react'
import { PageSlot } from '@/components/layout/page-slot'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { RoleForm } from '@/components/roles/role-form'
import { useRolesStore } from '@/stores/roles-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { CreateRoleData } from '@/types/roles'

export default function CreateRolePage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { createRole, error, clearError } = useRolesStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect to 404 if user lacks permission
  useEffect(() => {
    if (!hasPermission('roles.create')) {
      router.replace('/404')
    }
  }, [hasPermission, router])

  const handleSubmit = async (data: CreateRoleData): Promise<boolean> => {
    setIsSubmitting(true)
    const success = await createRole(data)
    setIsSubmitting(false)

    if (success) {
      addToast({
        title: 'Success',
        description: 'Role created successfully',
        color: 'success',
        timeout: 3000,
      })
      router.push('/roles')
    }

    return success
  }

  const handleCancel = () => {
    clearError()
    router.push('/roles')
  }

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Roles', href: '/roles' }, { label: 'Create New Role' }]} />

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Role</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create a new role with specific permissions for your team members.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardBody className="p-6">
            <RoleForm
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
