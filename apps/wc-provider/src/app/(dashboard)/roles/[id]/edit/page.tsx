'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addToast, Card, CardBody } from '@heroui/react'
import { PageSlot } from '@/components/layout/page-slot'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { RoleForm } from '@/components/roles/role-form'
import { useRolesStore } from '@/stores/roles-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { CreateRoleData, UpdateRoleData } from '@/types/roles'

export default function EditRolePage() {
  const router = useRouter()
  const params = useParams()
  const roleId = params.id as string
  const { hasPermission } = usePermissions()

  const { roles, fetchRoles, updateRole, error, clearError, isLoading } = useRolesStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const role = roles.find(r => r.id === roleId)

  // Redirect to 404 if user lacks permission
  useEffect(() => {
    if (!hasPermission('roles.update')) {
      router.replace('/404')
    }
  }, [hasPermission, router])

  useEffect(() => {
    if (roles.length === 0) {
      void fetchRoles()
    }
  }, [roles.length, fetchRoles])

  const handleSubmit = async (data: CreateRoleData): Promise<boolean> => {
    setIsSubmitting(true)

    // Convert CreateRoleData to UpdateRoleData (exclude isSystemRole for updates)
    const updateData: UpdateRoleData = {
      name: data.name,
      permissionIds: data.permissionIds,
    }

    const success = await updateRole(roleId, updateData)
    setIsSubmitting(false)

    if (success) {
      addToast({
        title: 'Success',
        description: 'Role updated successfully',
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

  // Show loading state while fetching role data
  if (isLoading || !role) {
    return (
      <PageSlot>
        <div className="space-y-6">
          <Breadcrumb items={[{ label: 'Roles', href: '/roles' }, { label: 'Edit Role' }]} />
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Loading role data...</p>
          </div>
        </div>
      </PageSlot>
    )
  }

  // Prevent editing system-managed roles (e.g. the "Admin" role)
  if (role.isSystemRole) {
    return (
      <PageSlot>
        <div className="space-y-6">
          <Breadcrumb items={[{ label: 'Roles', href: '/roles' }, { label: role.name }]} />
          <Card>
            <CardBody className="p-6">
              <div className="text-center py-8">
                <p className="text-danger font-medium">This system role cannot be edited.</p>
                <button
                  onClick={() => router.push('/roles')}
                  className="mt-4 text-primary hover:underline"
                >
                  Return to Roles
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageSlot>
    )
  }

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: 'Roles', href: '/roles' }, { label: `Edit Role: "${role.name}"` }]}
        />

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Role</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Update the role name and permissions for "{role.name}".
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardBody className="p-6">
            <RoleForm
              role={role}
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
