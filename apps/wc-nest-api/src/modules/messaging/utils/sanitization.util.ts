import sanitizeHtml from 'sanitize-html'

/**
 * Sanitization Utility
 *
 * Provides functions for sanitizing user input to prevent XSS attacks
 * and ensure data integrity in the messaging system.
 */

/**
 * Sanitize plain text content
 *
 * Removes all HTML tags and dangerous characters while preserving
 * basic text formatting (newlines, spaces).
 *
 * @param text - Raw text input
 * @returns Sanitized plain text
 */
export function sanitizePlainText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // Remove all HTML tags
  const sanitized = sanitizeHtml(text, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  })

  // Trim excessive whitespace but preserve single newlines
  return sanitized.trim()
}

/**
 * Sanitize rich text content (HTML)
 *
 * Allows safe HTML tags for formatting while removing dangerous
 * elements like scripts, iframes, and event handlers.
 *
 * Allowed tags: p, br, strong, em, u, a, ul, ol, li, blockquote, code, pre
 *
 * @param html - Raw HTML input
 * @returns Sanitized HTML
 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      span: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    // Enforce target="_blank" for external links
    transformTags: {
      a: (tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }
      },
    },
  })
}

/**
 * Sanitize URL
 *
 * Validates and sanitizes URLs to prevent javascript: and data: schemes
 *
 * @param url - Raw URL input
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim()

  // Block dangerous schemes
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:']
  const lowerUrl = trimmed.toLowerCase()

  for (const scheme of dangerousSchemes) {
    if (lowerUrl.startsWith(scheme)) {
      return ''
    }
  }

  // Only allow http, https, mailto
  if (
    !lowerUrl.startsWith('http://') &&
    !lowerUrl.startsWith('https://') &&
    !lowerUrl.startsWith('mailto:')
  ) {
    return ''
  }

  return trimmed
}

/**
 * Sanitize file name
 *
 * Removes path traversal characters and dangerous file name patterns
 *
 * @param fileName - Raw file name
 * @returns Sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'unnamed-file'
  }

  // Remove path traversal characters
  let sanitized = fileName.replace(/\.\./g, '')
  sanitized = sanitized.replace(/[/\\]/g, '')

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || ''
    const name = sanitized.substring(0, 255 - ext.length - 1)
    sanitized = `${name}.${ext}`
  }

  return sanitized || 'unnamed-file'
}
