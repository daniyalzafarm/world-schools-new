import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

/**
 * Custom validator for strong password validation
 * Enforces the following requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments) {
    if (!password || typeof password !== 'string') {
      return false
    }

    // Check minimum length
    if (password.length < 8) {
      return false
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return false
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return false
    }

    return true
  }

  defaultMessage(args: ValidationArguments) {
    return 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>)'
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
