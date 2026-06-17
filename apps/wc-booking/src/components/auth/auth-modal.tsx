'use client'

import { Modal, ModalContent } from '@heroui/react'
import { ArrowLeft, X } from 'lucide-react'

import { type AuthModalContext, useAuthModalStore } from '@/stores/auth-modal-store'
import { SignInForm } from '@/components/auth/forms/sign-in-form'
import { SignUpForm } from '@/components/auth/forms/sign-up-form'
import { ForgotPasswordForm } from '@/components/auth/forms/forgot-password-form'
import { VerifyEmailForm } from '@/components/auth/forms/verify-email-form'
import { Verify2FAForm } from '@/components/auth/forms/verify-2fa-form'

const CONTEXT_TITLES: Record<Exclude<AuthModalContext, 'generic'>, string> = {
  message: 'Log in to send a message',
  save: 'Log in to save this camp',
  book: 'Log in to book',
  review: 'Log in to write a review',
}

const chromeButtonClass =
  'cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors'

export function AuthModal() {
  const { isOpen, view, context, email, userId, close, setView, setFlow, completeAuth } =
    useAuthModalStore()

  // Forgot uses its own "Back to signin" button; signup uses its "Sign in" link.
  const canGoBack = view === 'verify-email' || view === 'verify-2fa'

  const renderForm = () => {
    switch (view) {
      case 'signin':
        return (
          <SignInForm
            title={context === 'generic' ? undefined : CONTEXT_TITLES[context]}
            onSuccess={completeAuth}
            onRequiresTwoFactor={(uid, mail) => {
              setFlow({ userId: uid, email: mail })
              setView('verify-2fa')
            }}
            onEmailNotVerified={mail => {
              setFlow({ email: mail })
              setView('verify-email')
            }}
            onForgotPassword={() => setView('forgot')}
            onSignUp={() => setView('signup')}
          />
        )
      case 'signup':
        return (
          <SignUpForm
            onSuccess={mail => {
              setFlow({ email: mail })
              setView('verify-email')
            }}
            onSignIn={() => setView('signin')}
          />
        )
      case 'forgot':
        return <ForgotPasswordForm onBackToSignIn={() => setView('signin')} />
      case 'verify-email':
        return (
          <VerifyEmailForm
            email={email ?? ''}
            onSuccess={completeAuth}
            onRequiresSignIn={() => setView('signin')}
          />
        )
      case 'verify-2fa':
        return <Verify2FAForm userId={userId ?? ''} email={email ?? ''} onSuccess={completeAuth} />
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      hideCloseButton
      scrollBehavior="inside"
      classNames={{
        // z above the camp nav drawer (z-[1000]/[1001]) so it can be opened from there.
        wrapper: 'z-[1100]',
        backdrop: 'z-[1100] bg-black/50',
        base: 'relative mx-0 my-0 sm:mx-0 sm:my-0 rounded-t-[20px] rounded-b-none sm:rounded-3xl sm:max-w-[440px] max-h-[92svh] sm:max-h-[90svh] bg-white',
      }}
    >
      <ModalContent>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Back (left) + close (right) — float in the header row, title stays centered */}
        {canGoBack && (
          <button
            type="button"
            onClick={() => setView('signin')}
            className={`absolute left-4 top-4 z-20 ${chromeButtonClass}`}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className={`absolute right-4 top-4 z-20 ${chromeButtonClass}`}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {renderForm()}
      </ModalContent>
    </Modal>
  )
}
