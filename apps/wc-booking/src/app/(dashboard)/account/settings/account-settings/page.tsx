'use client'

import React from 'react'
import { ComingSoon } from '@/components/ui/coming-soon'

const AccountSettingsPage = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your account preferences and login email
        </p>
      </div>

      {/* Content */}
      <ComingSoon />
    </div>
  )
}

export default AccountSettingsPage
