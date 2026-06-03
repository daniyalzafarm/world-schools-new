import { describe, expect, it } from 'vitest'
import { validateRedirectUrl } from './notifications-page-content'

describe('validateRedirectUrl (Phase 14c open-redirect guard)', () => {
  it.each([
    ['/bookings/BG-1', '/bookings/BG-1'],
    ['/account/settings', '/account/settings'],
    ['/', '/'],
  ])('accepts safe relative-root paths: %s', (input, expected) => {
    expect(validateRedirectUrl(input)).toBe(expected)
  })

  it.each([
    'https://attacker.com/phish',
    'http://attacker.com',
    '//attacker.com', // protocol-relative — browser treats as full origin
    '//evil.example/path',
    'mailto:foo@bar.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'app.example.com', // missing leading slash
    '',
  ])('rejects unsafe URL: %s', input => {
    expect(validateRedirectUrl(input)).toBeNull()
  })

  it.each(['/bookings/../admin', '/..', '/foo/../../bar'])(
    'rejects traversal segments: %s',
    input => {
      expect(validateRedirectUrl(input)).toBeNull()
    }
  )

  it.each([null, undefined, 42, {}, [], true])('rejects non-string input: %p', input => {
    expect(validateRedirectUrl(input)).toBeNull()
  })
})
