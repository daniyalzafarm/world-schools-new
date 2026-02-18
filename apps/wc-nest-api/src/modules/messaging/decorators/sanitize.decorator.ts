import { Transform } from 'class-transformer'
import { sanitizePlainText, sanitizeRichText } from '../utils/sanitization.util'

/**
 * Sanitize Decorators
 *
 * Transform decorators that automatically sanitize input values
 * during DTO transformation (before validation).
 */

/**
 * Sanitize plain text
 *
 * Removes all HTML tags and dangerous characters.
 * Use this for message content, titles, descriptions, etc.
 *
 * @example
 * ```typescript
 * class SendMessageDto {
 *   @SanitizePlainText()
 *   @IsString()
 *   @MaxLength(10000)
 *   content: string
 * }
 * ```
 */
export function SanitizePlainText() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value
    }
    return sanitizePlainText(value)
  })
}

/**
 * Sanitize rich text (HTML)
 *
 * Allows safe HTML tags while removing dangerous elements.
 * Use this for rich text message content.
 *
 * @example
 * ```typescript
 * class SendRichMessageDto {
 *   @SanitizeRichText()
 *   @IsString()
 *   @MaxLength(10000)
 *   content: string
 * }
 * ```
 */
export function SanitizeRichText() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value
    }
    return sanitizeRichText(value)
  })
}

/**
 * Trim whitespace
 *
 * Trims leading and trailing whitespace from strings.
 *
 * @example
 * ```typescript
 * class CreateLabelDto {
 *   @Trim()
 *   @IsString()
 *   @MaxLength(50)
 *   name: string
 * }
 * ```
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value
    }
    return value.trim()
  })
}

/**
 * Sanitize array of strings
 *
 * Sanitizes each string in an array.
 *
 * @example
 * ```typescript
 * class TagsDto {
 *   @SanitizeStringArray()
 *   @IsArray()
 *   @IsString({ each: true })
 *   tags: string[]
 * }
 * ```
 */
export function SanitizeStringArray() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value
    }
    return value.map(item => (typeof item === 'string' ? sanitizePlainText(item) : item))
  })
}
