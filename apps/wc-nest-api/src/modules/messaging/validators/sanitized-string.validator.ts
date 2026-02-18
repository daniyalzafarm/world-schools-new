import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { sanitizePlainText, sanitizeRichText, sanitizeUrl } from '../utils/sanitization.util'

/**
 * Custom validator for sanitized plain text
 *
 * Automatically sanitizes the input and validates that it's not empty after sanitization.
 * This prevents XSS attacks by removing all HTML tags.
 */
@ValidatorConstraint({ name: 'isSanitizedString', async: false })
export class IsSanitizedStringConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') {
      return false
    }

    // Sanitize the value
    const sanitized = sanitizePlainText(value)

    // Update the object with sanitized value
    ;(args.object as any)[args.property] = sanitized

    // Validate that sanitized value is not empty
    return sanitized.length > 0
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid string and cannot be empty after sanitization`
  }
}

/**
 * Decorator for sanitized plain text validation
 *
 * Automatically sanitizes input by removing all HTML tags and validates non-empty.
 *
 * @param validationOptions - Optional validation options
 */
export function IsSanitizedString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSanitizedStringConstraint,
    })
  }
}

/**
 * Custom validator for sanitized rich text (HTML)
 *
 * Allows safe HTML tags while removing dangerous elements.
 * Automatically sanitizes the input.
 */
@ValidatorConstraint({ name: 'isSanitizedHtml', async: false })
export class IsSanitizedHtmlConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') {
      return false
    }

    // Sanitize the HTML
    const sanitized = sanitizeRichText(value)

    // Update the object with sanitized value
    ;(args.object as any)[args.property] = sanitized

    // Validate that sanitized value is not empty
    return sanitized.length > 0
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be valid HTML and cannot be empty after sanitization`
  }
}

/**
 * Decorator for sanitized HTML validation
 *
 * Allows safe HTML tags for formatting while removing dangerous elements.
 *
 * @param validationOptions - Optional validation options
 */
export function IsSanitizedHtml(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSanitizedHtmlConstraint,
    })
  }
}

/**
 * Custom validator for sanitized URLs
 *
 * Validates and sanitizes URLs to prevent javascript: and data: schemes.
 */
@ValidatorConstraint({ name: 'isSanitizedUrl', async: false })
export class IsSanitizedUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') {
      return false
    }

    // Sanitize the URL
    const sanitized = sanitizeUrl(value)

    // Update the object with sanitized value
    ;(args.object as any)[args.property] = sanitized

    // Validate that sanitized URL is not empty (valid)
    return sanitized.length > 0
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid URL (http, https, or mailto only)`
  }
}

/**
 * Decorator for sanitized URL validation
 *
 * Only allows http, https, and mailto schemes.
 *
 * @param validationOptions - Optional validation options
 */
export function IsSanitizedUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSanitizedUrlConstraint,
    })
  }
}
