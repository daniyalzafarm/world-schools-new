'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ArrowLeft, Mail } from 'lucide-react'

import { Input } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'

// Detect user's operating system
const getOperatingSystem = (): 'windows' | 'macos' | 'other' => {
  if (typeof window === 'undefined') return 'other'

  const userAgent = window.navigator.userAgent.toLowerCase()

  if (userAgent.includes('win')) return 'windows'
  if (userAgent.includes('mac')) return 'macos'

  return 'other'
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setErrors({})
  }, [email])

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!email.trim()) {
      nextErrors.email = 'Please enter your email to continue.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setSubmitted(true)
  }

  const handleOpenGmail = () => {
    window.open('https://mail.google.com', '_blank')
  }

  const handleOpenPlatformEmail = () => {
    const os = getOperatingSystem()

    if (os === 'windows') {
      // Open Outlook web
      window.open('https://outlook.live.com', '_blank')
    } else if (os === 'macos') {
      // Open Apple Mail using mailto protocol
      window.location.href = `mailto:${email}`
    } else {
      // Fallback to mailto
      window.location.href = `mailto:${email}`
    }
  }

  const getPlatformEmailButtonText = (): string => {
    const os = getOperatingSystem()

    if (os === 'windows') return 'Open Outlook'
    if (os === 'macos') return 'Open Apple Mail'

    return 'Open Email'
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 space-y-6">
            {submitted ? (
              <>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 flex items-center justify-center">
                    <Mail className="w-12 h-12 text-secondary-500" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-secondary-500">
                      Reset password email sent!
                    </h1>
                    <p className="text-sm text-gray-500">
                      If your email is correct, you'll receive a password reset link at your email.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      radius="full"
                      color="primary"
                      className="font-semibold"
                      onPress={handleOpenGmail}
                      startContent={
                        <svg className="shrink-0 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z" />
                        </svg>
                      }
                    >
                      Open Gmail
                    </Button>

                    <Button
                      size="lg"
                      radius="full"
                      color="secondary"
                      className="font-semibold"
                      onPress={handleOpenPlatformEmail}
                      startContent={
                        getOperatingSystem() === 'macos' ? (
                          <svg className="shrink-0 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                          </svg>
                        ) : (
                          <svg className="shrink-0 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1.6q-.33 0-.57-.24-.23-.23-.23-.57V6.07q0-.36.18-.67.17-.32.5-.52L7.13.8q.33-.21.67-.21h12.8q.46 0 .8.33.32.33.32.8v3.66h-4.8q-.46 0-.8.33-.33.33-.33.8v7.66q0 .46.33.8.34.32.8.32h4.8zM7.13 2.4v3.66h3.66L7.13 2.4zm12.8 13.6V7.33h-8v8.67h8zm-4.8-2.4q0-.33.23-.56.24-.24.57-.24h1.6q.34 0 .57.24.24.23.24.56v1.6q0 .34-.24.57-.23.24-.57.24h-1.6q-.33 0-.57-.24-.23-.23-.23-.57v-1.6z" />
                          </svg>
                        )
                      }
                    >
                      {getPlatformEmailButtonText()}
                    </Button>
                  </div>

                  <Button
                    size="lg"
                    radius="full"
                    variant="light"
                    className="w-full font-semibold"
                    onPress={() => router.push('/auth/signin')}
                  >
                    Back to login
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-bold text-secondary-500">Forgot password</h1>
                  <p className="text-sm text-gray-500">
                    Enter your email to receive a password reset link
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onValueChange={value => setEmail(value)}
                    isInvalid={!!errors.email}
                    errorMessage={errors.email}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                  />
                  <div className="flex gap-4">
                    <Button
                      size="lg"
                      radius="full"
                      variant="light"
                      className="w-full font-semibold"
                      onPress={() => router.push('/auth/signin')}
                    >
                      Back to login
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      radius="full"
                      color="primary"
                      className="w-full font-semibold"
                    >
                      Send Email
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
