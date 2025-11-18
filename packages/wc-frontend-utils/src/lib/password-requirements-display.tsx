/**
 * Password Requirements Display Component
 *
 * A reusable component that displays password requirements with visual feedback
 * showing which requirements are met and which are not.
 */

'use client'

import React from 'react'
import { Check, X } from 'lucide-react'
import { passwordRequirements, type PasswordRequirement } from './password-validation'

export interface PasswordRequirementsDisplayProps {
  password: string
  className?: string
  showTitle?: boolean
}

export function PasswordRequirementsDisplay({
  password,
  className = '',
  showTitle = true,
}: PasswordRequirementsDisplayProps) {
  return (
    <div className={className}>
      {showTitle && (
        <p className="text-sm font-medium text-gray-700 mb-2">Password must contain:</p>
      )}
      <ul className="space-y-1.5">
        {passwordRequirements.map((requirement: PasswordRequirement, index: number) => {
          const isMet = requirement.test(password)
          return (
            <li key={index} className="flex items-center gap-2 text-sm">
              {isMet ? (
                <Check size={16} className="text-green-600 shrink-0" />
              ) : (
                <X size={16} className="text-gray-400 shrink-0" />
              )}
              <span className={isMet ? 'text-green-700' : 'text-gray-600'}>
                {requirement.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

