'use client'

import React, { useState } from 'react'
import { Button, Input, Link } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'

import { Logo } from '@/components/layout/logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!email) {
      setError('Please enter your work email to continue.')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setError(null)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex flex-col">
      <header className="py-6 px-6">
        <Logo size="lg" />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-18">
        <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur rounded-3xl shadow-xl p-10 space-y-8">
          <div className="space-y-2 text-left">
            <Link href="/auth/signin" className="inline-flex items-center gap-2 text-sm text-primary">
              <ArrowLeft size={16} /> Back to sign in
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reset your password</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Enter the email address associated with your World Camps Superadmin account. We will send a temporary link to reset your password.
            </p>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

          {submitted ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-emerald-800 space-y-2">
              <h2 className="text-xl font-semibold">Check your inbox</h2>
              <p>
                We sent password reset instructions to <span className="font-medium">{email}</span>. The link will expire in 30 minutes.
              </p>
              <p className="text-sm text-emerald-700">Did not receive an email? Check your spam folder or contact support.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                type="email"
                label="Work email"
                labelPlacement="outside"
                placeholder="you@worldcamps.org"
                value={email}
                onValueChange={value => setEmail(value)}
                variant="bordered"
                radius="full"
                size="lg"
                classNames={{
                  inputWrapper:
                    'border border-slate-200 bg-white hover:border-primary focus-within:border-primary shadow-sm',
                }}
              />

              <Button type="submit" size="lg" radius="full" color="primary" className="w-full font-semibold">
                Send reset link
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
