import { describe, it, expect } from 'vitest'
import { parseDuration } from './parse-duration'

describe('parseDuration', () => {
  it('should parse seconds correctly', () => {
    expect(parseDuration('30s')).toBe(30000)
    expect(parseDuration('1s')).toBe(1000)
  })

  it('should parse minutes correctly', () => {
    expect(parseDuration('15m')).toBe(900000)
    expect(parseDuration('1m')).toBe(60000)
  })

  it('should parse hours correctly', () => {
    expect(parseDuration('1h')).toBe(3600000)
    expect(parseDuration('2h')).toBe(7200000)
  })

  it('should parse days correctly', () => {
    expect(parseDuration('7d')).toBe(604800000)
    expect(parseDuration('1d')).toBe(86400000)
  })

  it('should return default value for invalid format', () => {
    expect(parseDuration('invalid')).toBe(900000) // 15 minutes default
    expect(parseDuration('15')).toBe(900000)
    expect(parseDuration('m15')).toBe(900000)
  })
})

