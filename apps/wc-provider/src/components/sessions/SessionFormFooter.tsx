'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'

interface SessionFormFooterProps {
  campId: string
  onCancel: () => void
  onSubmit: () => void
  isSubmitting?: boolean
  mode?: 'create' | 'edit'
}

/**
 * SessionFormFooter Component
 * Footer for session creation and editing pages
 * Matches the design and positioning of CampEditorFooter
 * Uses fixed positioning to replace the main footer on session form pages
 * Includes "Back to Sessions" button on the left and action buttons on the right
 */
export function SessionFormFooter({
  campId,
  onCancel,
  onSubmit,
  isSubmitting = false,
  mode = 'create',
}: SessionFormFooterProps) {
  const router = useRouter()

  const handleBackToSessions = () => {
    router.push(`/camps/${campId}/edit/sessions`)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-default-100 bg-white px-12 py-4 md:left-[280px]">
      <div className="mx-auto max-w-4xl px-12 flex items-center justify-between">
        {/* Back to Sessions Button */}
        <Button
          variant="flat"
          startContent={<ChevronLeft className="w-4 h-4" />}
          onPress={handleBackToSessions}
          isDisabled={isSubmitting}
        >
          Back to Sessions
        </Button>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button size="lg" variant="bordered" onPress={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="lg"
            color="primary"
            onPress={onSubmit}
            isLoading={isSubmitting}
            className="font-semibold"
          >
            {mode === 'edit' ? 'Update Session' : 'Create Session'}
          </Button>
        </div>
      </div>
    </div>
  )
}
