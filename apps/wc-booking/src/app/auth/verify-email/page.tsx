'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Logo } from '@/components/layout/logo'
import { VerifyEmailForm } from '@/components/auth/forms/verify-email-form'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const codeFromUrl = searchParams.get('code') || ''

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <VerifyEmailForm
              email={email}
              initialCode={codeFromUrl}
              onSuccess={() => router.replace('/')}
              onRequiresSignIn={() => router.push('/auth/signin')}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
