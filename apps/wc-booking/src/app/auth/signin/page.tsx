'use client'

import { useRouter } from 'next/navigation'

import { Logo } from '@/components/layout/logo'
import { SignInForm } from '@/components/auth/forms/sign-in-form'

export default function SignInPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <SignInForm
              onSuccess={() => router.replace('/')}
              onRequiresTwoFactor={(userId, email) =>
                router.push(
                  `/auth/verify-2fa?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`
                )
              }
              onEmailNotVerified={email =>
                router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
              }
              onForgotPassword={() => router.push('/auth/forgot-password')}
              onSignUp={() => router.push('/auth/signup')}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
