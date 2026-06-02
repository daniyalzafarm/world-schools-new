/**
 * Cross-product date/age validation for the booking flow. Pure and
 * dependency-free so the two frontends (wc-booking, wc-provider) and the
 * NestJS API enforce identical rules.
 *
 * UTC discipline: ISO date-only inputs ("2026-06-22") parse as UTC midnight.
 * All calendar math here uses `getUTC*` so a child's computed age / a session's
 * bookability do not shift by a day for viewers west of UTC — the same
 * convention used in `cancellation-policy.ts`.
 */

export function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Whole-years age a child will be on `atDate` (typically the session start).
 * Returns null when either date is missing/invalid.
 */
export function calculateAgeAtDate(
  dob: string | Date | null | undefined,
  atDate: string | Date | null | undefined
): number | null {
  const birth = toDate(dob)
  const at = toDate(atDate)
  if (!birth || !at) return null

  let age = at.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = at.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age--
  }
  return age
}

export interface BookableSessionInput {
  /** Session status; when present must equal 'published' to be bookable. */
  status?: string | null
  startDate: string | Date | null | undefined
  endDate?: string | Date | null | undefined
}

/** Why a session is not bookable, or null when it is. */
export type SessionBookabilityIssue = 'not_published' | 'in_past' | 'invalid_dates'

export function sessionBookabilityIssue(
  session: BookableSessionInput,
  now: Date = new Date()
): SessionBookabilityIssue | null {
  if (session.status != null && session.status !== 'published') return 'not_published'
  const start = toDate(session.startDate)
  if (!start) return 'invalid_dates'
  const end = toDate(session.endDate)
  if (end && start.getTime() >= end.getTime()) return 'invalid_dates'
  // Must start strictly in the future — a session that has already started (or
  // started in the past) is no longer bookable.
  if (start.getTime() <= now.getTime()) return 'in_past'
  return null
}

/** True when the session is published, has sane dates, and starts in the future. */
export function isSessionBookable(session: BookableSessionInput, now: Date = new Date()): boolean {
  return sessionBookabilityIssue(session, now) === null
}

export function isSessionInFuture(
  startDate: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  const start = toDate(startDate)
  return start != null && start.getTime() > now.getTime()
}

/** Whole days between two dates (UTC, floored). Negative when `to` precedes `from`. */
export function wholeDaysBetween(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined
): number | null {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return null
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}
