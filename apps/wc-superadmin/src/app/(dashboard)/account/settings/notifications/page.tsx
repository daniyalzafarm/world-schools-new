'use client'

import React from 'react'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Notification Preferences
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Manage how you receive notifications
        </p>
      </div>

      <ComingSoon />
    </div>
  )
}
