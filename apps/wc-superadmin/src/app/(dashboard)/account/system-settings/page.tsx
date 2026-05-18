'use client'

import React, { useEffect, useState } from 'react'
import { addToast, Button, Spinner } from '@heroui/react'
import { Settings2 } from 'lucide-react'
import * as adminSettingsService from '@/services/admin-settings.services'

export default function SystemSettingsPage() {
  const [defaultAppFee, setDefaultAppFee] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    const response = await adminSettingsService.getSystemSettings()
    if (response.success && response.data) {
      setDefaultAppFee(String(response.data.defaultAppFee))
      setLastUpdatedAt(response.data.updatedAt)
    }
    setIsLoading(false)
  }

  const handleSave = async () => {
    const parsed = parseFloat(defaultAppFee)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      addToast({
        title: 'Validation error',
        description: 'App fee must be a number between 0 and 100.',
        color: 'danger',
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await adminSettingsService.updateSystemSettings({
        defaultAppFee: parsed,
      })

      if (response.success && response.data) {
        setLastUpdatedAt(response.data.updatedAt)
        addToast({
          title: 'Saved',
          description: 'System settings updated successfully.',
          color: 'success',
        })
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to save settings. Please try again.',
          color: 'danger',
        })
      }
    } catch {
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Platform-wide configuration applied to all providers.
        </p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* App Fee Section */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Default App Fee
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Default app fee percentage charged on each booking. This rate is snapshotted onto
                new providers when their Stripe account is created and can be negotiated
                per-provider thereafter.
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="defaultAppFee"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Default app fee (%)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-40">
                    <input
                      id="defaultAppFee"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={defaultAppFee}
                      onChange={e => setDefaultAppFee(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      %
                    </span>
                  </div>

                  <Button
                    color="primary"
                    size="sm"
                    onPress={() => void handleSave()}
                    isLoading={isSaving}
                    isDisabled={isSaving}
                  >
                    Save
                  </Button>
                </div>

                {lastUpdatedAt && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Last updated:{' '}
                    {new Date(lastUpdatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
