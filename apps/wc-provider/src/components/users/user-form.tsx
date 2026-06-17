'use client'

import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { Input, SelectField } from '@world-schools/ui-web'
import { Eye, EyeOff } from 'lucide-react'
import type { CreateUserData, User } from '@/types/users'
import { useRolesStore } from '@/stores/roles-store'

interface UserFormProps {
  user?: User | null
  isEdit?: boolean
  onSubmit: (data: CreateUserData) => Promise<boolean>
  onCancel: () => void
  storeError?: string | null
  isSubmitting?: boolean
}

const initialFormData: CreateUserData = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  roleIds: [],
}

export function UserForm({
  user = null,
  isEdit = false,
  onSubmit,
  onCancel,
  storeError = null,
  isSubmitting = false,
}: UserFormProps) {
  const [formData, setFormData] = useState<CreateUserData>(initialFormData)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { roles, fetchRoles } = useRolesStore()

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  useEffect(() => {
    if (user && isEdit) {
      const roleId = user.roles.length > 0 ? user.roles[0].roleId : ''
      setFormData({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        password: '',
        roleIds: roleId ? [roleId] : [],
      })
      setSelectedRole(roleId)
      setConfirmPassword('')
    }
  }, [user, isEdit])

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!isEdit && !formData.password) {
      newErrors.password = 'Password is required for new users'
    }

    if (formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters'
      } else if (!/(?=.*[a-z])/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one lowercase letter'
      } else if (!/(?=.*[A-Z])/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one uppercase letter'
      } else if (!/(?=.*\d)/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one number'
      } else if (!/(?=.*[@$!%*?&#])/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one special character (@$!%*?&#)'
      }
    }

    if (formData.password && formData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!selectedRole) {
      newErrors.role = 'Role is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId)
    setFormData(prev => ({
      ...prev,
      roleIds: roleId ? [roleId] : [],
    }))

    if (errors.role) {
      setErrors(prev => ({ ...prev, role: '' }))
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    const userData: CreateUserData = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      roleIds: formData.roleIds,
    }

    // Only include password if it's provided
    if (formData.password) {
      userData.password = formData.password
    }

    await onSubmit(userData)
  }

  return (
    <div className="space-y-6">
      {/* Row 1: First Name and Last Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          labelPlacement="outside"
          placeholder="Enter first name"
          value={formData.firstName}
          onChange={e => {
            setFormData(prev => ({ ...prev, firstName: e.target.value }))
            if (errors.firstName) {
              setErrors(prev => ({ ...prev, firstName: '' }))
            }
          }}
          isInvalid={!!errors.firstName}
          errorMessage={errors.firstName}
          isRequired
        />
        <Input
          label="Last Name"
          labelPlacement="outside"
          placeholder="Enter last name"
          value={formData.lastName}
          onChange={e => {
            setFormData(prev => ({ ...prev, lastName: e.target.value }))
            if (errors.lastName) {
              setErrors(prev => ({ ...prev, lastName: '' }))
            }
          }}
          isInvalid={!!errors.lastName}
          errorMessage={errors.lastName}
        />
      </div>

      {/* Row 2: Email and Role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          labelPlacement="outside"
          placeholder="Enter email address"
          type="email"
          value={formData.email}
          onChange={e => {
            setFormData(prev => ({ ...prev, email: e.target.value }))
            if (errors.email) {
              setErrors(prev => ({ ...prev, email: '' }))
            }
          }}
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          isRequired
        />
        <SelectField
          label="Role"
          placeholder="Select a role"
          value={selectedRole}
          onChange={handleRoleChange}
          options={roles.map(role => ({ value: role.id, label: role.name }))}
          isInvalid={!!errors.role}
          errorMessage={errors.role}
          isRequired
        />
      </div>

      {/* Row 3: Password and Confirm Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={isEdit ? 'Password (leave blank to keep current)' : 'Password'}
          labelPlacement="outside"
          placeholder="Enter password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={e => {
            setFormData(prev => ({ ...prev, password: e.target.value }))
            if (errors.password) {
              setErrors(prev => ({ ...prev, password: '' }))
            }
          }}
          isInvalid={!!errors.password}
          errorMessage={errors.password}
          isRequired={!isEdit}
          endContent={
            <button
              className="focus:outline-none"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          }
        />
        <Input
          label="Confirm Password"
          labelPlacement="outside"
          placeholder="Re-enter password"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={e => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) {
              setErrors(prev => ({ ...prev, confirmPassword: '' }))
            }
          }}
          isInvalid={!!errors.confirmPassword}
          errorMessage={errors.confirmPassword}
          isRequired={!isEdit && !!formData.password}
          endContent={
            <button
              className="focus:outline-none"
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          }
        />
      </div>

      {/* Password Requirements */}
      {formData.password && (
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-sm font-semibold mb-2">Password Requirements:</p>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            <li className={formData.password.length >= 8 ? 'text-success' : ''}>
              • At least 8 characters
            </li>
            <li className={/(?=.*[a-z])/.test(formData.password) ? 'text-success' : ''}>
              • At least one lowercase letter
            </li>
            <li className={/(?=.*[A-Z])/.test(formData.password) ? 'text-success' : ''}>
              • At least one uppercase letter
            </li>
            <li className={/(?=.*\d)/.test(formData.password) ? 'text-success' : ''}>
              • At least one number
            </li>
            <li className={/(?=.*[@$!%*?&#])/.test(formData.password) ? 'text-success' : ''}>
              • At least one special character (@$!%*?&#)
            </li>
          </ul>
        </div>
      )}

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
          {isEdit ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </div>
  )
}
