'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Logo } from '@/components/layout/logo'
import { Verify2FAForm } from '@/components/auth/forms/verify-2fa-form'

function Verify2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const userId = searchParams.get('userId')
  const email = searchParams.get('email')

  // Redirect if no userId or email
  useEffect(() => {
    if (!userId || !email) {
      router.push('/auth/signin')
    }
  }, [userId, email, router])

  if (!userId || !email) return null

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <Verify2FAForm userId={userId} email={email} onSuccess={() => router.replace('/')} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Verify2FAContent />
    </Suspense>
  )
}
