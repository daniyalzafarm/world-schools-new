'use client'

import { useRouter } from 'next/navigation'

import { Logo } from '@/components/layout/logo'
import { SignUpForm } from '@/components/auth/forms/sign-up-form'

export default function SignUpPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <SignUpForm
              onSuccess={email =>
                router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
              }
              onSignIn={() => router.push('/auth/signin')}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
