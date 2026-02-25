'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Switch,
} from '@heroui/react'
import { Eye, EyeOff, Monitor, Smartphone, Tablet, X } from 'lucide-react'
import Link from 'next/link'

import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@world-schools/ui-web'
import { ProtectedRoute } from '@/components/auth/protected-route'
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'
import * as securityService from '@/services/security.services'
import type { Session, TwoFactorStatus } from '@world-schools/wc-types'

const SecuritySettingsPage = () => {
  const { user, changePassword, clearError } = useAuthStore()

  // Password state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)

  // 2FA state
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)
  const [is2FALoading, setIs2FALoading] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([])
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)

  // Load data on mount
  useEffect(() => {
    void loadTwoFactorStatus()
    void loadSessions()
  }, [])

  const loadTwoFactorStatus = async () => {
    setIs2FALoading(true)
    const response = await securityService.getTwoFactorStatus()
    if (response.success && response.data) {
      setTwoFactorStatus(response.data)
    }
    setIs2FALoading(false)
  }

  const loadSessions = async () => {
    setIsSessionsLoading(true)
    const response = await securityService.getSessions()
    if (response.success && response.data) {
      setSessions(response.data.sessions || [])
    }
    setIsSessionsLoading(false)
  }

  const handlePasswordChange = async () => {
    // Clear previous messages
    setPasswordError(null)
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
      const success = await changePassword({
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      if (success) {
        addToast({
          title: 'Success',
          description: 'Password changed successfully',
          color: 'success',
        })
        setPasswordModalOpen(false)
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        setTimeout(() => {
          const currentError = useAuthStore.getState().error
          if (currentError) {
            setPasswordError(currentError)
            clearError()
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

  const handleToggle2FA = async () => {
    if (!twoFactorStatus) return

    setIs2FALoading(true)

    try {
      const response = twoFactorStatus.enabled
        ? await securityService.disableTwoFactor()
        : await securityService.enableTwoFactor()

      if (response.success) {
        addToast({
          title: 'Success',
          description: twoFactorStatus.enabled
            ? 'Two-factor authentication disabled'
            : 'Two-factor authentication enabled',
          color: 'success',
        })
        await loadTwoFactorStatus()
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to update two-factor authentication',
          color: 'danger',
        })
      }
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update two-factor authentication',
        color: 'danger',
      })
    } finally {
      setIs2FALoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    const response = await securityService.revokeSession(sessionId)
    if (response.success) {
      addToast({
        title: 'Success',
        description: 'Session revoked successfully',
        color: 'success',
      })
      await loadSessions()
    } else {
      addToast({
        title: 'Error',
        description: 'Failed to revoke session',
        color: 'danger',
      })
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    const response = await securityService.revokeAllOtherSessions()
    if (response.success) {
      addToast({
        title: 'Success',
        description: 'All other sessions revoked successfully',
        color: 'success',
      })
      await loadSessions()
    } else {
      addToast({
        title: 'Error',
        description: 'Failed to revoke sessions',
        color: 'danger',
      })
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />
      case 'tablet':
        return <Tablet className="w-5 h-5" />
      default:
        return <Monitor className="w-5 h-5" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const passwordChangedAt = user?.passwordChangedAt
    ? new Date(user.passwordChangedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Never'

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
        {/* Page Header */}
        <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
          <div className="h-20 px-10 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Login & security
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6">
          {/* Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Password</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Last changed: {passwordChangedAt}
                </p>
              </div>
              <Button color="secondary" variant="flat" onPress={() => setPasswordModalOpen(true)}>
                Change password
              </Button>
            </div>
          </div>

          {/* 2FA Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Two-factor authentication
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                isSelected={twoFactorStatus?.enabled ?? false}
                onValueChange={handleToggle2FA}
                isDisabled={is2FALoading}
                color="secondary"
              />
            </div>
          </div>

          {/* Active Sessions Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Active sessions
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Manage devices where you're currently logged in
                </p>
              </div>
              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  onPress={handleRevokeAllOtherSessions}
                >
                  Revoke all others
                </Button>
              )}
            </div>

            {isSessionsLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No active sessions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {session.deviceName}
                        </p>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {session.browser} on {session.os}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {session.location} • Last active {formatDate(session.lastActiveAt)}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleRevokeSession(session.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account & Privacy Link */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Account & privacy
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Manage your account settings and privacy preferences
                </p>
              </div>
              <Link href="/settings/profile">
                <Button color="secondary" variant="flat">
                  View settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false)
          setPasswordData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          })
          setPasswordError(null)
        }}
        size="2xl"
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="text-xl font-semibold">Change password</ModalHeader>
          <ModalBody className="gap-5">
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              </div>
            )}

            <Input
              type={showCurrentPassword ? 'text' : 'password'}
              label="Current password"
              labelPlacement="outside"
              placeholder="Enter current password"
              value={passwordData.currentPassword}
              onValueChange={value => {
                setPasswordData(prev => ({ ...prev, currentPassword: value }))
                if (passwordError) setPasswordError(null)
              }}
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
              isRequired
            />

            <Input
              type={showNewPassword ? 'text' : 'password'}
              label="New password"
              labelPlacement="outside"
              placeholder="Enter new password"
              value={passwordData.newPassword}
              onValueChange={value => {
                setPasswordData(prev => ({ ...prev, newPassword: value }))
                if (passwordError) setPasswordError(null)
              }}
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
              isRequired
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

            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              label="Confirm new password"
              labelPlacement="outside"
              placeholder="Confirm new password"
              value={passwordData.confirmPassword}
              onValueChange={value => {
                setPasswordData(prev => ({ ...prev, confirmPassword: value }))
                if (passwordError) setPasswordError(null)
              }}
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
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setPasswordModalOpen(false)
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                })
                setPasswordError(null)
              }}
              isDisabled={isPasswordSaving}
            >
              Cancel
            </Button>
            <Button
              color="secondary"
              onPress={handlePasswordChange}
              isLoading={isPasswordSaving}
              isDisabled={
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              }
            >
              {isPasswordSaving ? 'Changing...' : 'Change password'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ProtectedRoute>
  )
}

export default SecuritySettingsPage
