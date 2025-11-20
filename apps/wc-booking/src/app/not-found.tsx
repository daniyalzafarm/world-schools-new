'use client'

import { Button } from '@heroui/react'
import { FileQuestion } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
          <FileQuestion size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Page not found</h1>
          <p className="text-slate-600 dark:text-slate-300">
            The page you're looking for doesn't exist or you don't have permission to access it.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button color="primary" radius="full" size="lg" onPress={() => router.push('/')}>
            Go to Home
          </Button>
          <Button variant="bordered" radius="full" size="lg" onPress={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
