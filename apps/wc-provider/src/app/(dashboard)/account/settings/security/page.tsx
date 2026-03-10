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
import {
  getPasswordStrengthHeroColor,
  getPasswordStrengthLabel,
  PasswordRequirementsDisplay,
  validatePassword,
} from '@world-schools/wc-frontend-utils'
import * as securityService from '@/services/security.services'
import type { Session, TwoFactorStatus } from '@world-schools/wc-types'

export default function SecuritySettingsPage() {
  const { user, changePassword, clearError } = useAuthStore()

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

  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)
  const [is2FALoading, setIs2FALoading] = useState(false)

  const [sessions, setSessions] = useState<Session[]>([])
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)

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
    setPasswordError(null)
    clearError()

    const passwordValidation = validatePassword(passwordData.newPassword)
    if (!passwordValidation.isValid) {
      setPasswordError('Password does not meet all requirements')
      return
    }

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
    <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="mb-10">
        <h1 className="text-[32px] font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Login & security
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Manage your password and keep your account secure.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 py-5 pr-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Password
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last changed {passwordChangedAt}
            </p>
          </div>
          <Button onPress={() => setPasswordModalOpen(true)} variant="light" className="underline">
            Edit
          </Button>
        </div>

        <section className="flex items-start justify-between gap-4 py-5 pr-4">
          <div>
            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100 mb-1">
              Two-factor authentication
              {twoFactorStatus?.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                  Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  Not enabled
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 leading-[1.4] mb-2">
              Use email verification codes to secure your account
            </div>
          </div>
          <Switch
            isSelected={twoFactorStatus?.enabled ?? false}
            onValueChange={handleToggle2FA}
            isDisabled={is2FALoading}
            color="secondary"
            className="px-4 mt-2"
          />
        </section>

        <section>
          <div className="mb-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Active sessions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Devices where you&apos;re currently signed in
            </p>
          </div>

          {isSessionsLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">No active sessions</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-px bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className="flex items-start gap-4 p-4 bg-white dark:bg-gray-900"
                  >
                    <div
                      className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                        session.isCurrent
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {session.browser} on {session.os}
                        </p>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-500 dark:text-gray-400">
                        {session.location} · Last active {formatDate(session.lastActiveAt)}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <div className="shrink-0">
                        <Button
                          variant="light"
                          onPress={() => handleRevokeSession(session.id)}
                          color="danger"
                        >
                          Sign out
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <div className="mt-4">
                  <Button
                    variant="light"
                    onPress={handleRevokeAllOtherSessions}
                    className="underline"
                    color="danger"
                  >
                    Sign out of all other sessions
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4 py-0 pr-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                Account & Privacy
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Export your data, deactivate or delete your account
              </div>
            </div>
            <div className="shrink-0">
              <Link
                href="/account/settings/privacy"
                className="text-sm px-4 font-medium text-gray-900 dark:text-gray-100 underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                Manage
              </Link>
            </div>
          </div>
        </section>
      </div>

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
        size="md"
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
    </div>
  )
}
