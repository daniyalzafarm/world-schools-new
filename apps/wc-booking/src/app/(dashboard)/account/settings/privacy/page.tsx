'use client'

import React, { useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { AlertCircle, Shield } from 'lucide-react'
import Link from 'next/link'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { Input } from '@world-schools/ui-web'

const PrivacyDataPage = () => {
  // Modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Form state
  const [deactivatePassword, setDeactivatePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  // Loading state
  const [isExporting, setIsExporting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRequestExport = () => {
    setExportModalOpen(true)
  }

  const handleConfirmExport = async () => {
    setIsExporting(true)
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      addToast({
        title: 'Success',
        description: 'Data export requested. Check your email within 24 hours.',
        color: 'success',
      })
      setExportModalOpen(false)
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to request data export',
        color: 'danger',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeactivateAccount = async () => {
    if (!deactivatePassword) {
      addToast({
        title: 'Error',
        description: 'Please enter your password',
        color: 'danger',
      })
      return
    }

    setIsDeactivating(true)
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      addToast({
        title: 'Success',
        description: 'Account deactivated. You can reactivate by logging in.',
        color: 'success',
      })
      setDeactivateModalOpen(false)
      setDeactivatePassword('')
      // TODO: Redirect to logout
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to deactivate account',
        color: 'danger',
      })
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast({
        title: 'Error',
        description: 'Please type DELETE to confirm',
        color: 'danger',
      })
      return
    }

    if (!deletePassword) {
      addToast({
        title: 'Error',
        description: 'Please enter your password',
        color: 'danger',
      })
      return
    }

    setIsDeleting(true)
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      addToast({
        title: 'Account Deletion Initiated',
        description:
          'You will receive a confirmation email. Your account will be permanently deleted within 30 days.',
        color: 'success',
      })
      setDeleteModalOpen(false)
      setDeleteConfirmText('')
      setDeletePassword('')
      // TODO: Redirect to homepage
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to delete account',
        color: 'danger',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-full w-full bg-white dark:bg-gray-900">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-[32px] font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Privacy & Data
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Manage your data, privacy settings, and account status.
          </p>
        </div>

        {/* GDPR Info Box */}
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-5 mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[10px] bg-primary-500 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-semibold text-primary-900 dark:text-primary-100">
              Your Privacy Rights
            </h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Under GDPR and other privacy regulations, you have the right to access, export, and
            delete your personal data. You can also temporarily deactivate your account at any time.{' '}
            <Link
              href="/privacy-policy"
              className="text-primary-700 dark:text-primary-400 underline"
            >
              Read our Privacy Policy
            </Link>{' '}
            for more information about how we protect your data.
          </p>
        </div>

        {/* Your Data Section */}
        <div className="mb-10">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Your Data
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Access and download your personal information
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* Download Your Data Row */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-5 px-6">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Download Your Data
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Request a copy of all your personal data in a portable format (JSON).
                </p>
              </div>
              <Button
                variant="light"
                color="secondary"
                className="underline"
                onPress={handleRequestExport}
              >
                Request export
              </Button>
            </div>

            {/* Privacy Policy Row */}
            <div className="flex items-center justify-between py-5 px-6">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Privacy Policy
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Learn how we collect, use, and protect your personal information.
                </p>
              </div>
              <Button
                as={Link}
                href="/privacy-policy"
                variant="light"
                color="secondary"
                className="underline"
              >
                View policy
              </Button>
            </div>
          </div>
        </div>

        {/* Account Status Section (Danger Zone) */}
        <div className="mb-10">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Account Status
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Deactivate or permanently delete your account
            </p>
          </div>

          <div className="space-y-4">
            {/* Deactivate Account Box */}
            <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-warning-900 dark:text-warning-100 mb-2">
                    Deactivate Account
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    Temporarily disable your account. Your data will be preserved and you can
                    reactivate at any time by logging in. Any active bookings will remain valid.
                  </p>
                </div>
                <Button
                  color="warning"
                  variant="flat"
                  size="sm"
                  onPress={() => setDeactivateModalOpen(true)}
                >
                  Deactivate
                </Button>
              </div>
            </div>

            {/* Delete Account Box */}
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-danger-900 dark:text-danger-100 mb-2">
                    Delete Account Permanently
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                    Permanently delete your account and request erasure of your personal data. This
                    action cannot be undone.
                  </p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-danger-200 dark:border-danger-800">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Please note:
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-danger-500 mt-0.5">•</span>
                        <span>Transaction records retained for 7 years (legal requirement)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-danger-500 mt-0.5">•</span>
                        <span>
                          Active bookings will be cancelled and may incur cancellation fees
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-danger-500 mt-0.5">•</span>
                        <span>Reviews you&apos;ve written will be anonymized</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  onPress={() => setDeleteModalOpen(true)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Export Modal */}
        <Modal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          size="md"
          placement="center"
        >
          <ModalContent>
            <ModalHeader>
              <h3 className="text-lg font-semibold">Request Data Export</h3>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We&apos;ll prepare a complete copy of your personal data in JSON format. This
                includes:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Profile information and contact details</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Booking history and preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Reviews and ratings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Communication history</span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                You&apos;ll receive a download link via email within 24 hours.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setExportModalOpen(false)}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleConfirmExport} isLoading={isExporting}>
                Confirm Export
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Deactivate Account Modal */}
        <Modal
          isOpen={deactivateModalOpen}
          onClose={() => {
            setDeactivateModalOpen(false)
            setDeactivatePassword('')
          }}
          size="md"
          placement="center"
        >
          <ModalContent>
            <ModalHeader>
              <h3 className="text-lg font-semibold">Deactivate Account</h3>
            </ModalHeader>
            <ModalBody>
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning-900 dark:text-warning-100 mb-1">
                      Your account will be temporarily disabled
                    </p>
                    <p className="text-xs text-warning-700 dark:text-warning-300">
                      You can reactivate at any time by logging in. Your data will be preserved.
                    </p>
                  </div>
                </div>
              </div>
              <Input
                type="password"
                label="Confirm your password"
                placeholder="Enter your password"
                value={deactivatePassword}
                onChange={e => setDeactivatePassword(e.target.value)}
                autoComplete="current-password"
              />
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={() => {
                  setDeactivateModalOpen(false)
                  setDeactivatePassword('')
                }}
              >
                Cancel
              </Button>
              <Button color="warning" onPress={handleDeactivateAccount} isLoading={isDeactivating}>
                Deactivate Account
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false)
            setDeleteConfirmText('')
            setDeletePassword('')
          }}
          size="md"
          placement="center"
        >
          <ModalContent>
            <ModalHeader>
              <h3 className="text-lg font-semibold">Delete Account Permanently</h3>
            </ModalHeader>
            <ModalBody>
              <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-danger-900 dark:text-danger-100 mb-1">
                      This action cannot be undone
                    </p>
                    <p className="text-xs text-danger-700 dark:text-danger-300">
                      Your account and personal data will be permanently deleted within 30 days.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Input
                  label="Type DELETE to confirm"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  description="Type the word DELETE in capital letters"
                />
                <Input
                  type="password"
                  label="Confirm your password"
                  placeholder="Enter your password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={() => {
                  setDeleteModalOpen(false)
                  setDeleteConfirmText('')
                  setDeletePassword('')
                }}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={handleDeleteAccount}
                isLoading={isDeleting}
                isDisabled={deleteConfirmText !== 'DELETE' || !deletePassword}
              >
                Delete Account
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </ProtectedRoute>
  )
}

export default PrivacyDataPage
