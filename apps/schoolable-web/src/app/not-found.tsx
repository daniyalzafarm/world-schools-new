'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { User } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-4">
            <User size={48} />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Sorry, the page you're looking for doesn't exist or you don't have permission to access
            it.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Button
            color="primary"
            size="lg"
            onPress={() => router.push('/')}
            className="w-full bg-primary-dark"
          >
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
