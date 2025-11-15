'use client'

import { Button } from '@heroui/react'
import { ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function NotAuthorizedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Access requires superadmin privileges
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            You attempted to view an area that is restricted to members of the Superadmin team.
            Please sign in with an authorized account or contact the workspace owner.
          </p>
        </div>
        <Button color="primary" radius="full" size="lg" onPress={() => router.push('/auth/signin')}>
          Return to sign in
        </Button>
      </div>
    </div>
  )
}
