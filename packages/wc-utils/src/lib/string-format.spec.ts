import { describe, it, expect } from 'vitest'
import { formatSnakeCaseToTitleCase } from './string-format'

describe('formatSnakeCaseToTitleCase', () => {
  it('should convert snake_case to Title Case', () => {
    expect(formatSnakeCaseToTitleCase('incomplete_information')).toBe('Incomplete Information')
    expect(formatSnakeCaseToTitleCase('invalid_documents')).toBe('Invalid Documents')
    expect(formatSnakeCaseToTitleCase('failed_verification')).toBe('Failed Verification')
    expect(formatSnakeCaseToTitleCase('policy_violation')).toBe('Policy Violation')
    expect(formatSnakeCaseToTitleCase('other')).toBe('Other')
  })

  it('should handle single words', () => {
    expect(formatSnakeCaseToTitleCase('test')).toBe('Test')
    expect(formatSnakeCaseToTitleCase('UPPERCASE')).toBe('Uppercase')
  })

  it('should handle empty strings', () => {
    expect(formatSnakeCaseToTitleCase('')).toBe('')
  })

  it('should handle multiple underscores', () => {
    expect(formatSnakeCaseToTitleCase('this_is_a_test')).toBe('This Is A Test')
  })
})

