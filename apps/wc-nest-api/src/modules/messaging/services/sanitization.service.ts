import { Injectable, Logger } from '@nestjs/common'
import { sanitizePlainText, sanitizeRichText, sanitizeUrl } from '../utils/sanitization.util'

/**
 * Sanitization Service
 *
 * Centralized service for sanitizing user input across the messaging module.
 * Provides logging and consistent sanitization behavior.
 */
@Injectable()
export class SanitizationService {
  private readonly logger = new Logger(SanitizationService.name)

  /**
   * Sanitize message content based on content type
   *
   * @param content - Raw message content
   * @param contentType - Type of content (TEXT, HTML, etc.)
   * @returns Sanitized content
   */
  sanitizeMessageContent(content: string, contentType: 'TEXT' | 'HTML' = 'TEXT'): string {
    if (!content) {
      return ''
    }

    const originalLength = content.length
    let sanitized: string

    if (contentType === 'HTML') {
      sanitized = sanitizeRichText(content)
      this.logger.debug(`Sanitized HTML content: ${originalLength} -> ${sanitized.length} chars`)
    } else {
      sanitized = sanitizePlainText(content)
      this.logger.debug(`Sanitized plain text: ${originalLength} -> ${sanitized.length} chars`)
    }

    // Log if significant content was removed (potential XSS attempt)
    const removedChars = originalLength - sanitized.length
    if (removedChars > 50) {
      this.logger.warn(
        `Significant content removed during sanitization: ${removedChars} characters (${((removedChars / originalLength) * 100).toFixed(1)}%)`
      )
    }

    return sanitized
  }

  /**
   * Sanitize conversation title or subject
   *
   * @param title - Raw title
   * @returns Sanitized title
   */
  sanitizeTitle(title: string): string {
    if (!title) {
      return ''
    }

    const sanitized = sanitizePlainText(title)
    this.logger.debug(`Sanitized title: "${title}" -> "${sanitized}"`)
    return sanitized
  }

  /**
   * Sanitize URL
   *
   * @param url - Raw URL
   * @returns Sanitized URL or empty string if invalid
   */
  sanitizeUrl(url: string): string {
    if (!url) {
      return ''
    }

    const sanitized = sanitizeUrl(url)

    if (!sanitized) {
      this.logger.warn(`Blocked dangerous URL: ${url}`)
    }

    return sanitized
  }

  /**
   * Sanitize array of strings
   *
   * @param items - Array of raw strings
   * @returns Array of sanitized strings
   */
  sanitizeStringArray(items: string[]): string[] {
    if (!Array.isArray(items)) {
      return []
    }

    return items.map(item => sanitizePlainText(item)).filter(item => item.length > 0)
  }

  /**
   * Validate and sanitize mention usernames
   *
   * Ensures mentions are valid usernames without special characters
   *
   * @param mentions - Array of mentioned usernames
   * @returns Array of valid usernames
   */
  sanitizeMentions(mentions: string[]): string[] {
    if (!Array.isArray(mentions)) {
      return []
    }

    return mentions
      .map(mention => {
        // Remove @ symbol if present
        const cleaned = mention.replace(/^@/, '')

        // Only allow alphanumeric, underscore, hyphen
        const sanitized = cleaned.replace(/[^a-zA-Z0-9_-]/g, '')

        return sanitized
      })
      .filter(mention => mention.length > 0 && mention.length <= 50)
  }
}
