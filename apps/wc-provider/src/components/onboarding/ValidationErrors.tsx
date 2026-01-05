'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@heroui/react'
import type { ValidationError } from '../../utils/onboarding-validation'

interface ValidationErrorsProps {
  errors: ValidationError[]
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  const router = useRouter()

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border-2 border-danger bg-danger-50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="h-6 w-6 text-danger" />
        <h3 className="text-lg font-semibold text-foreground">Application Incomplete</h3>
      </div>

      <p className="mb-4 text-sm text-default-500">
        Please complete the following required items before submitting your application:
      </p>

      <div className="space-y-3">
        {errors.map((error, index) => (
          <div
            key={index}
            className="flex items-start justify-between gap-4 rounded-lg bg-white p-4"
          >
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">
                  Step {error.step}
                </span>
                <span className="text-sm font-semibold text-foreground">{error.stepName}</span>
              </div>
              <p className="text-sm text-default-500">{error.message}</p>
            </div>
            <Button
              size="sm"
              variant="bordered"
              color="primary"
              onPress={() => router.push(error.path)}
            >
              Fix Now
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
