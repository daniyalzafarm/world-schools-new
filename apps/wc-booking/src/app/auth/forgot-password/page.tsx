'use client'

import { useRouter } from 'next/navigation'

import { Logo } from '@/components/layout/logo'
import { ForgotPasswordForm } from '@/components/auth/forms/forgot-password-form'

export default function ForgotPasswordPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <ForgotPasswordForm onBackToSignIn={() => router.push('/auth/signin')} />
          </div>
        </div>
      </main>
    </div>
  )
}
