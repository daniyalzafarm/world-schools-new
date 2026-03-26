'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function CampBookingLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="min-h-screen bg-white">
        <header className="hidden sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur lg:block">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16 md:px-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Back
            </button>
            <p className="text-sm font-semibold text-gray-900 md:text-base">World Camps</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Secure booking
            </p>
          </div>
        </header>
        <header className="lg:hidden">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="rounded-md p-2 text-gray-700 hover:bg-gray-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900">World Camps</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Secure booking
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Close"
              className="rounded-md p-2 text-gray-700 hover:bg-gray-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>
        {children}
      </div>
    </ProtectedRoute>
  )
}
