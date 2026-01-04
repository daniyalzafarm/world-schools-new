'use client'

import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Input } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'
import type { CreateRoleData, Role } from '@/types/roles'
import { getPermissions, type PermissionGroup } from '@/services/permissions.services'
import {
  getGroupKeyForPermission,
  getNavigationPermission,
  isNavigationPermission,
  NAVIGATION_PERMISSIONS,
  type NavigationPermissionConfig,
} from '@/config/navigation-permissions'

interface RoleFormProps {
  role?: Role | null
  isEdit?: boolean
  onSubmit: (data: CreateRoleData) => Promise<boolean>
  onCancel: () => void
  storeError?: string | null
  isSubmitting?: boolean
}

const initialFormData: CreateRoleData = {
  name: '',
  permissionIds: [],
}

export function RoleForm({
  role = null,
  isEdit = false,
  onSubmit,
  onCancel,
  storeError = null,
  isSubmitting = false,
}: RoleFormProps) {
  const [formData, setFormData] = useState<CreateRoleData>(initialFormData)
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)

  // Fetch permissions on mount
  useEffect(() => {
    const fetchPermissionsData = async () => {
      setIsLoadingPermissions(true)
      try {
        const result = await getPermissions()
        if (result.success && result.data) {
          setPermissionGroups(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error)
      } finally {
        setIsLoadingPermissions(false)
      }
    }

    void fetchPermissionsData()
  }, [])

  useEffect(() => {
    if (role && isEdit) {
      const permissionIds = role.permissions.map(p => p.permission.id)
      setFormData({
        name: role.name,
        permissionIds: permissionIds,
      })
      setSelectedPermissions(new Set(permissionIds))
    }
  }, [role, isEdit])

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Role name is required'
    }

    if (selectedPermissions.size === 0) {
      newErrors.permissions = 'At least one permission is required'
    }

    // Validate navigation permissions
    const navigationErrors = validateNavigationPermissions()
    if (Object.keys(navigationErrors).length > 0) {
      // Combine all navigation errors into a single message
      const errorMessages = Object.values(navigationErrors)
      newErrors.navigationPermissions = errorMessages.join(' ')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    const newSelectedPermissions = new Set(selectedPermissions)

    if (checked) {
      newSelectedPermissions.add(permissionId)

      // Auto-select navigation permission for this group if not already selected
      const groupKey = getGroupKeyForPermission(permissionId)
      if (groupKey) {
        const navPermission = getNavigationPermission(groupKey)
        if (navPermission && !newSelectedPermissions.has(navPermission)) {
          newSelectedPermissions.add(navPermission)
        }
      }
    } else {
      newSelectedPermissions.delete(permissionId)
    }

    setSelectedPermissions(newSelectedPermissions)

    // Update formData with permission IDs array
    setFormData(prev => ({
      ...prev,
      permissionIds: Array.from(newSelectedPermissions),
    }))

    // Clear permission errors
    if (errors.permissions) {
      setErrors(prev => ({ ...prev, permissions: '' }))
    }
    // Clear navigation permission errors if they're now resolved
    if (errors.navigationPermissions) {
      setErrors(prev => ({ ...prev, navigationPermissions: '' }))
    }
  }

  const handleGroupCheckboxChange = (group: PermissionGroup, checked: boolean) => {
    const newSelectedPermissions = new Set(selectedPermissions)

    group.permissions.forEach(permission => {
      if (checked) {
        newSelectedPermissions.add(permission.id)
      } else {
        newSelectedPermissions.delete(permission.id)
      }
    })

    setSelectedPermissions(newSelectedPermissions)

    setFormData(prev => ({
      ...prev,
      permissionIds: Array.from(newSelectedPermissions),
    }))

    // Clear permission errors
    if (errors.permissions) {
      setErrors(prev => ({ ...prev, permissions: '' }))
    }
    // Clear navigation permission errors if they're now resolved
    if (errors.navigationPermissions) {
      setErrors(prev => ({ ...prev, navigationPermissions: '' }))
    }
  }

  const isGroupSelected = (group: PermissionGroup): boolean => {
    return group.permissions.every(permission => selectedPermissions.has(permission.id))
  }

  const isGroupIndeterminate = (group: PermissionGroup): boolean => {
    const selectedCount = group.permissions.filter(permission =>
      selectedPermissions.has(permission.id)
    ).length
    return selectedCount > 0 && selectedCount < group.permissions.length
  }

  const hasNavigationPermissions = (group: PermissionGroup): boolean => {
    const groupKey = group.name.toLowerCase().replace(/\s+/g, '_')
    const navPermission = getNavigationPermission(groupKey)
    if (!navPermission) return false
    return selectedPermissions.has(navPermission)
  }

  const validateNavigationPermissions = (): { [groupName: string]: string } => {
    const navigationErrors: { [groupName: string]: string } = {}

    Object.entries(NAVIGATION_PERMISSIONS).forEach(
      ([groupKey, config]: [string, NavigationPermissionConfig]) => {
        const { navigationPermission, label, groupPermissions } = config

        if (!groupPermissions) return

        const hasNonNavPermissions = groupPermissions.some(
          permId => permId !== navigationPermission && selectedPermissions.has(permId)
        )

        const hasNavPermission = selectedPermissions.has(navigationPermission)

        if (hasNonNavPermissions && !hasNavPermission) {
          const navPermissionName =
            permissionGroups.flatMap(g => g.permissions).find(p => p.id === navigationPermission)
              ?.name || 'Read'

          navigationErrors[groupKey] =
            `Navigation permission required: You have selected permissions from the '${label}' group but haven't selected '${navPermissionName}' which is required for navigation access. Please select '${navPermissionName}' or deselect all other permissions from this group.`
        }
      }
    )

    return navigationErrors
  }

  const getNavigationError = (group: PermissionGroup): string | null => {
    const groupKey = group.name.toLowerCase().replace(/\s+/g, '_')
    const navigationErrors = validateNavigationPermissions()
    return navigationErrors[groupKey] || null
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    await onSubmit(formData)
  }

  return (
    <div className="space-y-6">
      {/* Role Name */}
      <div>
        <Input
          label="Role Name"
          labelPlacement="outside"
          placeholder="Enter role name"
          value={formData.name}
          onChange={e => {
            setFormData(prev => ({ ...prev, name: e.target.value }))
            if (errors.name) {
              setErrors(prev => ({ ...prev, name: '' }))
            }
          }}
          isInvalid={!!errors.name}
          errorMessage={errors.name}
          isRequired
        />
      </div>

      {/* Permissions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Permissions</h3>
        {errors.permissions && <p className="text-danger text-sm mb-4">{errors.permissions}</p>}
        {errors.navigationPermissions && (
          <Alert variant="bordered" color="danger" className="mb-4 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <span className="text-danger font-semibold">⚠️ Navigation Permission Required</span>
            </div>
            <p className="mt-2 text-danger-700 dark:text-danger-300">
              {errors.navigationPermissions}
            </p>
          </Alert>
        )}
        {isLoadingPermissions ? (
          <p className="text-sm text-gray-500">Loading permissions...</p>
        ) : (
          <div className="space-y-4">
            {permissionGroups.map(group => {
              const hasNavPermissions = hasNavigationPermissions(group)
              const groupKey = group.name.toLowerCase().replace(/\s+/g, '_')
              const _navPermission = getNavigationPermission(groupKey)
              const navError = getNavigationError(group)

              return (
                <div
                  key={group.name}
                  className={`border rounded-lg p-4 ${
                    navError
                      ? 'border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-950/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Checkbox
                      isSelected={isGroupSelected(group)}
                      isIndeterminate={isGroupIndeterminate(group)}
                      onValueChange={checked => handleGroupCheckboxChange(group, checked)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            navError
                              ? 'text-danger-600 dark:text-danger-400'
                              : hasNavPermissions
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {group.name}
                        </span>
                        {navError && (
                          <AlertTriangle
                            size={16}
                            className="text-danger-600 dark:text-danger-400"
                          />
                        )}
                      </span>
                    </Checkbox>
                    {hasNavPermissions && !navError && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        ✓ Navigation
                      </span>
                    )}
                    {navError && (
                      <span className="text-xs px-2 py-1 rounded-full bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200">
                        ⚠ Missing Navigation
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-6">
                    {group.permissions.map(permission => {
                      const isNavPermission = isNavigationPermission(permission.id)

                      return (
                        <Checkbox
                          key={permission.id}
                          isSelected={selectedPermissions.has(permission.id)}
                          onValueChange={checked => handlePermissionChange(permission.id, checked)}
                          size="sm"
                          classNames={{
                            label: isNavPermission
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-700 dark:text-gray-300',
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {permission.name}
                            {isNavPermission && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">
                                (Navigation)
                              </span>
                            )}
                          </span>
                        </Checkbox>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Error Messages */}
      {storeError && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
          <p className="text-danger text-sm font-medium">{storeError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button color="default" variant="light" onPress={onCancel} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
          {isEdit ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </div>
  )
}
