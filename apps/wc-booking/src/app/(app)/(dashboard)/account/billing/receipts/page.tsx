'use client'

import React from 'react'
import { BackButton } from '@world-schools/ui-web'
import { ComingSoon } from '@/components/ui/coming-soon'

const ReceiptsPage = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <BackButton href="/account" />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            Receipts & Invoices
          </h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          View your transaction history and download invoices
        </p>
      </div>

      {/* Content */}
      <ComingSoon />
    </div>
  )
}

export default ReceiptsPage
