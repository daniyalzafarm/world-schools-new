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
    <div className="mb-8">
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
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-base leading-normal text-default-500">{subtitle}</p>}
      </div>
    </div>
  )
}
