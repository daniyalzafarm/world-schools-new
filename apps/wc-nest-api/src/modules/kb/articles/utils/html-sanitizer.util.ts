import sanitizeHtml from 'sanitize-html'
import { KB_ALLOWED_ATTRIBUTES, KB_ALLOWED_CLASSES, KB_ALLOWED_TAGS } from '@world-schools/wc-utils'

/**
 * Validation result interface
 */
export interface HtmlValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validation error details
 */
export interface ValidationError {
  type: 'tag' | 'attribute' | 'class' | 'malicious'
  message: string
  detail?: string
}

/**
 * Validate article HTML content
 * Checks if HTML is valid without modifying it using sanitize-html library
 *
 * @param html - HTML string to validate
 * @returns Validation result with errors if any
 */
export function validateArticleHtml(html: string): HtmlValidationResult {
  const errors: string[] = []

  // Coerce readonly tuples from wc-utils into mutable arrays expected by sanitize-html types
  const allowedTags = [...KB_ALLOWED_TAGS]
  const allowedAttributes = [...KB_ALLOWED_ATTRIBUTES]
  const allowedClasses = [...KB_ALLOWED_CLASSES]

  // Configure sanitize-html with our whitelist
  const options: sanitizeHtml.IOptions = {
    allowedTags,
    allowedAttributes: {
      '*': allowedAttributes,
    },
    allowedClasses: {
      '*': allowedClasses,
    },
    // Disallow all protocols except http, https, and mailto
    allowedSchemes: ['http', 'https', 'mailto'],
    // Disallow data URIs
    allowedSchemesByTag: {},
    // Don't allow any iframe sources
    allowedIframeHostnames: [],
  }

  // Sanitize the HTML and compare with original
  const sanitized = sanitizeHtml(html, options)

  // If sanitized HTML is different from original, it means there were invalid elements
  if (sanitized !== html) {
    // Parse both to find differences
    const validationErrors = findHtmlDifferences(html, sanitized)
    errors.push(...validationErrors)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Find differences between original and sanitized HTML
 * Analyzes what was removed/changed to provide specific error messages
 *
 * @param original - Original HTML string
 * @param sanitized - Sanitized HTML string
 * @returns Array of error messages describing the differences
 */
function findHtmlDifferences(original: string, sanitized: string): string[] {
  const errors: string[] = []

  // If the sanitized version is significantly shorter, content was removed
  if (sanitized.length < original.length * 0.5) {
    errors.push(
      'Invalid HTML: Significant content was removed during validation. This likely indicates the presence of disallowed tags, attributes, or malicious code.'
    )
  }

  // Check for specific patterns that would be removed
  const dangerousPatterns = [
    { pattern: /<script[\s\S]*?<\/script>/gi, name: 'script tags' },
    { pattern: /javascript:/gi, name: 'javascript: protocol' },
    { pattern: /on\w+\s*=/gi, name: 'event handlers (onclick, onload, etc.)' },
    { pattern: /<iframe[\s\S]*?<\/iframe>/gi, name: 'iframe tags' },
    { pattern: /<object[\s\S]*?<\/object>/gi, name: 'object tags' },
    { pattern: /<embed[\s\S]*?>/gi, name: 'embed tags' },
    { pattern: /<style[\s\S]*?<\/style>/gi, name: 'style tags' },
  ]

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(original)) {
      errors.push(`Invalid HTML: Detected ${name} which are not allowed for security reasons.`)
    }
  }

  // Check for disallowed tags
  const tagRegex = /<\/?(\w+)(?:\s[^>]*)?\s*\/?>/g
  const foundTags = new Set<string>()
  let match

  while ((match = tagRegex.exec(original)) !== null) {
    const tagName = match[1].toLowerCase()
    if (!KB_ALLOWED_TAGS.includes(tagName as (typeof KB_ALLOWED_TAGS)[number])) {
      foundTags.add(tagName)
    }
  }

  if (foundTags.size > 0) {
    const invalidTagsList = Array.from(foundTags).join(', ')
    errors.push(
      `Invalid HTML: Tag(s) '${invalidTagsList}' not allowed. Only these tags are permitted: ${KB_ALLOWED_TAGS.join(', ')}`
    )
  }

  // Check for disallowed attributes
  const attrRegex = /<\w+\s+([^>]+)>/g
  const foundAttrs = new Set<string>()

  while ((match = attrRegex.exec(original)) !== null) {
    const attributesString = match[1]
    const individualAttrRegex = /(\w+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g
    let attrMatch

    while ((attrMatch = individualAttrRegex.exec(attributesString)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      if (!KB_ALLOWED_ATTRIBUTES.includes(attrName as (typeof KB_ALLOWED_ATTRIBUTES)[number])) {
        foundAttrs.add(attrName)
      }
    }
  }

  if (foundAttrs.size > 0) {
    const invalidAttrsList = Array.from(foundAttrs).join(', ')
    errors.push(
      `Invalid HTML: Attribute(s) '${invalidAttrsList}' not allowed. Only these attributes are permitted: ${KB_ALLOWED_ATTRIBUTES.join(', ')}`
    )
  }

  // Check for disallowed classes
  const classRegex = /class="([^"]*)"/g
  const foundClasses = new Set<string>()

  while ((match = classRegex.exec(original)) !== null) {
    const classes = match[1].split(' ').filter(c => c.trim())
    for (const className of classes) {
      if (!KB_ALLOWED_CLASSES.includes(className as (typeof KB_ALLOWED_CLASSES)[number])) {
        foundClasses.add(className)
      }
    }
  }

  if (foundClasses.size > 0) {
    const invalidClassesList = Array.from(foundClasses).join(', ')
    errors.push(
      `Invalid HTML: Class(es) '${invalidClassesList}' not allowed. Only kb-* classes are permitted: ${KB_ALLOWED_CLASSES.join(', ')}`
    )
  }

  // If no specific errors were found but HTML is different, provide generic message
  if (errors.length === 0) {
    errors.push(
      'Invalid HTML: The HTML content contains elements that do not meet validation requirements. Please ensure all tags, attributes, and classes are from the allowed list.'
    )
  }

  return errors
}

/**
 * @deprecated Use validateArticleHtml() instead
 * Validate that HTML only contains allowed kb-* classes
 * Used for backward compatibility
 *
 * @param html - HTML string to validate
 * @returns true if valid, false otherwise
 */
export function validateKbClasses(html: string): boolean {
  const result = validateArticleHtml(html)
  return result.isValid
}

/**
 * Get list of allowed KB classes
 * Useful for frontend validation and documentation
 */
export function getAllowedKbClasses(): string[] {
  return [...KB_ALLOWED_CLASSES]
}
