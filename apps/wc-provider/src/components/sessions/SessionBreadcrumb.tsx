'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@heroui/react'

interface SessionBreadcrumbProps {
  campId: string
  title: string
  subtitle?: string
}

/**
 * Session Breadcrumb Component
 * Provides navigation breadcrumb for session forms
 */
export function SessionBreadcrumb({ campId, title, subtitle }: SessionBreadcrumbProps) {
  const router = useRouter()

  const handleBack = () => {
    router.push(`/camps/${campId}/edit/sessions`)
  }

  return (
    <div className="mb-6">
      {/* Back Button */}
      <Button
        variant="light"
        startContent={<ChevronLeft className="w-4 h-4" />}
        onPress={handleBack}
        className="mb-4 -ml-2 text-default-600 hover:text-default-900"
      >
        Back to Sessions
      </Button>

      {/* Page Title */}
      <div>
        <h1 className="text-[28px] font-bold text-default-900">{title}</h1>
        {subtitle && <p className="text-[14px] text-default-600 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
