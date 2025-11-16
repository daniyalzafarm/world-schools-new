/**
 * Parse a duration string (e.g., '15m', '7d', '1h') into milliseconds
 *
 * @param duration - Duration string with format: number + unit (s|m|h|d)
 * @returns Duration in milliseconds
 *
 * @example
 * ```typescript
 * parseDuration('15m')  // 900000 (15 minutes)
 * parseDuration('7d')   // 604800000 (7 days)
 * parseDuration('1h')   // 3600000 (1 hour)
 * parseDuration('30s')  // 30000 (30 seconds)
 * ```
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) {
    return 900000 // Default 15 minutes
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  const multipliers: Record<string, number> = {
    s: 1000, // seconds
    m: 60000, // minutes
    h: 3600000, // hours
    d: 86400000, // days
  }

  return value * multipliers[unit]
}

