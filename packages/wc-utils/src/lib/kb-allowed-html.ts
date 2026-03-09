/**
 * Shared Knowledge Base HTML allowlists.
 *
 * These are used by:
 * - Backend HTML validation (Nest API)
 * - Superadmin article editor UI (for reference)
 * - CSS docs in kb-classes.css
 *
 * Keep these arrays in sync with:
 * - world-schools/packages/wc-frontend-utils/src/styles/kb-classes.css
 */

export const KB_ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'code',
  'div',
  'span',
  'figure',
  'img',
  'figcaption',
] as const

export const KB_ALLOWED_ATTRIBUTES = ['href', 'src', 'alt', 'id', 'class', 'target', 'rel'] as const

export const KB_ALLOWED_CLASSES = [
  'kb-container',
  'kb-section-title',
  'kb-paragraph',
  'kb-step-list',
  'kb-step',
  'kb-step-title',
  'kb-step-desc',
  'kb-list',
  'kb-tip',
  'kb-note',
  'kb-warning',
  'kb-image',
  'kb-related',
  'kb-related-title',
  'kb-related-list',
] as const
