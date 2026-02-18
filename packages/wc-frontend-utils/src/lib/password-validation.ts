/**
 * Password Validation Utilities for World Camps Applications
 *
 * This module provides shared password validation logic and requirements
 * that can be used across all authentication pages.
 */

export interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

/**
 * Standard password requirements for World Camps applications
 * Following modern security best practices
 */
export const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: pwd => pwd.length >= 8 },
  { label: 'At least one uppercase letter', test: pwd => /[A-Z]/.test(pwd) },
  { label: 'At least one lowercase letter', test: pwd => /[a-z]/.test(pwd) },
  { label: 'At least one number', test: pwd => /\d/.test(pwd) },
  { label: 'At least one special character', test: pwd => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) },
]

/**
 * Validates a password against all requirements
 * @param password - The password to validate
 * @returns Object with validation result and unmet requirements
 */
export function validatePassword(password: string): {
  isValid: boolean
  unmetRequirements: PasswordRequirement[]
  metRequirements: PasswordRequirement[]
  strength: number // 0-100
} {
  const metRequirements = passwordRequirements.filter(req => req.test(password))
  const unmetRequirements = passwordRequirements.filter(req => !req.test(password))
  const strength = (metRequirements.length / passwordRequirements.length) * 100

  return {
    isValid: unmetRequirements.length === 0,
    unmetRequirements,
    metRequirements,
    strength,
  }
}

/**
 * Gets a color class based on password strength
 * @param strength - Password strength (0-100)
 * @returns Tailwind color class
 */
export function getPasswordStrengthColor(strength: number): string {
  if (strength === 0) return 'bg-gray-200'
  if (strength < 40) return 'bg-red-500'
  if (strength < 60) return 'bg-orange-500'
  if (strength < 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

/**
 * Gets a text label for password strength
 * @param strength - Password strength (0-100)
 * @returns Strength label
 */
export function getPasswordStrengthLabel(strength: number): string {
  if (strength === 0) return ''
  if (strength < 40) return 'Weak'
  if (strength < 60) return 'Fair'
  if (strength < 80) return 'Good'
  return 'Strong'
}

/**
 * Gets Hero UI color value based on password strength
 * @param strength - Password strength (0-100)
 * @returns Hero UI color value for Progress component
 */
export function getPasswordStrengthHeroColor(
  strength: number
): 'default' | 'danger' | 'warning' | 'primary' | 'success' {
  if (strength === 0) return 'default'
  if (strength < 40) return 'danger' // Weak - red
  if (strength < 60) return 'warning' // Fair - yellow/orange
  if (strength < 80) return 'primary' // Good - blue
  return 'success' // Strong - green
}
