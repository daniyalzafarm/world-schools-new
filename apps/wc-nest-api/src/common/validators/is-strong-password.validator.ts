import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

export const STRONG_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>)'

/**
 * Pure strength check for a password string.
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function isStrongPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false
  }

  if (password.length < 8) {
    return false
  }

  if (!/[A-Z]/.test(password)) {
    return false
  }

  if (!/[a-z]/.test(password)) {
    return false
  }

  if (!/\d/.test(password)) {
    return false
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return false
  }

  return true
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, _args: ValidationArguments) {
    return isStrongPassword(password)
  }

  defaultMessage(_args: ValidationArguments) {
    return STRONG_PASSWORD_MESSAGE
  }
}

/**
 * Decorator for strong password validation
 * @param validationOptions - Optional validation options
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    })
  }
}
