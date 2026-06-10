/**
 * Shared camp-eligibility engine — the single source of truth for whether a
 * child may be booked into a camp. Pure and Prisma-free so the API (authoritative
 * gate at submit) and both frontends (pre-validation UX) run identical rules.
 *
 * Rules enforced (see the approved plan):
 *   - Age: child's age at the session start must fall within one of the camp's
 *     age groups.
 *   - Gender: STRICT — boys⇒male, girls⇒female, coed⇒any. Unspecified /
 *     unmappable child gender fails a boys/girls camp.
 *   - Skill GATE: for each GATE-mode CampEligibilityRequirement, the child's
 *     skill level for that activity must be >= the minimum (compared via the
 *     activity scale's level order).
 *   - Readiness: DOB present, >=1 emergency contact, and (residential camps
 *     only) medical info present.
 */
import type { EligibilityFailure, EligibilityResult } from '@world-schools/wc-types'
import { calculateAgeAtDate, startOfUtcDay, toDate } from './date-validation'

export type CampGenderRequirement = 'coed' | 'boys' | 'girls'
export type NormalizedGender = 'male' | 'female' | 'other'

export interface AgeRange {
  min: number
  max: number
}

export interface ChildSkillInput {
  /** Activity.id — matches CampEligibilityRequirement.activityId. */
  activityId: string
  /** Matches an ActivityScaleLevel.value for the activity's scale. */
  levelValue: string
}

/** A date window of an existing booking the child already holds. */
export interface ExistingBookingRange {
  startDate: string | Date
  endDate: string | Date
}

/**
 * Session/cross-booking context that the overlap rule needs but that is not an
 * intrinsic property of the child. Optional so existing callers (and the
 * frontend, when it lacks the data) skip the rule — mirroring how `skills`
 * defaults to empty for skill GATEs.
 */
export interface EligibilityExtras {
  /** Session end — paired with `sessionStart` to form the booking window. */
  sessionEnd?: string | Date | null
  /** The child's other capacity-consuming bookings, for the overlap check. */
  existingBookings?: ExistingBookingRange[]
}

export interface EligibilityChildInput {
  id: string
  dateOfBirth: string | Date | null | undefined
  gender: string | null | undefined
  /** Children.emergencyContacts JSON (expected: array). */
  emergencyContacts: unknown
  /** Children.medicalInfo JSON. */
  medicalInfo: unknown
  skills: ChildSkillInput[]
}

export interface EligibilitySkillGate {
  activityId: string
  activityName?: string
  minimumLevelValue: string
  /** Ordered scale levels for the activity ({value, order}); order 1 = lowest. */
  scaleLevels: { value: string; order: number }[]
}

export interface EligibilityCampInput {
  gender: CampGenderRequirement
  ageGroups: AgeRange[]
  isResidential: boolean
  /** Only GATE-mode requirements — INFO requirements are advisory, not gating. */
  skillGates: EligibilitySkillGate[]
}

const MALE_TOKENS = new Set(['male', 'm', 'boy', 'boys', 'man'])
const FEMALE_TOKENS = new Set(['female', 'f', 'girl', 'girls', 'woman'])

/** Map a free-text child gender to a normalized token, or null when unmappable. */
export function normalizeChildGender(raw: string | null | undefined): NormalizedGender | null {
  if (raw == null) return null
  const v = String(raw).trim().toLowerCase()
  if (!v) return null
  if (MALE_TOKENS.has(v)) return 'male'
  if (FEMALE_TOKENS.has(v)) return 'female'
  return 'other'
}

export function hasEmergencyContact(emergencyContacts: unknown): boolean {
  return Array.isArray(emergencyContacts) && emergencyContacts.length >= 1
}

/** Mirrors the `hasMedicalInfo` heuristic in children.service.calculateProfileCompletion. */
export function hasMedicalInfo(medicalInfo: unknown): boolean {
  if (!medicalInfo || typeof medicalInfo !== 'object') return false
  const m = medicalInfo as Record<string, unknown>
  const nonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0
  const nonEmptyStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  return Boolean(
    nonEmptyArray(m['allergies']) ||
    nonEmptyArray(m['dietaryRequirements']) ||
    nonEmptyStr(m['medications']) ||
    nonEmptyStr(m['medicalConditions']) ||
    nonEmptyStr(m['specialNeeds']) ||
    nonEmptyStr(m['swimmingAbility'])
  )
}

export function hasDateOfBirth(dob: string | Date | null | undefined): boolean {
  return toDate(dob) != null
}

function formatAgeRanges(ranges: AgeRange[]): string {
  return ranges.map(r => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)).join(', ')
}

export function checkGenderEligibility(
  childGender: string | null | undefined,
  campGender: CampGenderRequirement
): EligibilityFailure | null {
  if (campGender === 'coed') return null
  const required: NormalizedGender = campGender === 'boys' ? 'male' : 'female'
  if (normalizeChildGender(childGender) === required) return null
  return {
    code: 'gender_mismatch',
    message: `This camp accepts ${campGender === 'boys' ? 'boys' : 'girls'} only.`,
    requiredGender: campGender,
  }
}

export function checkAgeEligibility(
  dob: string | Date | null | undefined,
  ageGroups: AgeRange[],
  sessionStart: string | Date
): EligibilityFailure | null {
  const age = calculateAgeAtDate(dob, sessionStart)
  if (age === null) return null // DOB-missing is reported by readiness, not here
  if (!ageGroups?.length) return null // no age restriction configured
  if (ageGroups.some(g => age >= g.min && age <= g.max)) return null
  return {
    code: 'age_out_of_range',
    message: `Child must be aged ${formatAgeRanges(ageGroups)} at the start of the camp (this child will be ${age}).`,
    childAge: age,
  }
}

/** Camp age group as stored/served — `id` is optional; the canonical key a
 * session references it by is `${min}-${max}`. */
export interface CampAgeGroupInput {
  id?: string | null
  ageGroupId?: string | null
  min: number
  max: number
}

/** The session fields that decide which of the camp's age groups it offers. */
export interface SessionAgeGroupInput {
  pricingType?: string | null
  availabilityType?: string | null
  /** Keys may be camelCase (`ageGroupId`) or the stored snake_case (`age_group_id`). */
  ageGroupPrices?: ({ ageGroupId?: string | null; age_group_id?: string | null } | null)[] | null
  ageGroupSpots?: ({ ageGroupId?: string | null; age_group_id?: string | null } | null)[] | null
}

function ageGroupRefId(
  entry: { ageGroupId?: string | null; age_group_id?: string | null } | null | undefined
): string | null {
  if (!entry) return null
  const raw = entry.ageGroupId ?? entry.age_group_id
  return raw != null ? String(raw) : null
}

/**
 * The age groups a specific session actually offers — the per-session band the
 * age check must use instead of the camp-wide range.
 *
 * A session limits itself to a subset of the camp's age groups by referencing
 * only those groups in its per-age-group pricing and/or availability
 * (`ageGroupPrices` / `ageGroupSpots`, keyed by `${min}-${max}`). A session that
 * uses single pricing AND single availability carries no references, so it
 * inherits the camp's full age range.
 *
 * Falls back to the full camp range when the session is absent or its references
 * match no camp age group (misconfigured data) — a booking is never blocked by
 * bad data; the camp-wide bound still applies.
 */
export function getSessionAgeGroups(
  campAgeGroups: CampAgeGroupInput[] | null | undefined,
  session: SessionAgeGroupInput | null | undefined
): AgeRange[] {
  const valid = (campAgeGroups ?? []).filter(
    g => typeof g?.min === 'number' && typeof g?.max === 'number'
  )
  const fullRange: AgeRange[] = valid.map(g => ({ min: g.min, max: g.max }))
  if (!session) return fullRange

  const referenced = new Set<string>()
  if (session.pricingType === 'age_group') {
    for (const p of session.ageGroupPrices ?? []) {
      const id = ageGroupRefId(p)
      if (id) referenced.add(id)
    }
  }
  if (session.availabilityType === 'age_group') {
    for (const s of session.ageGroupSpots ?? []) {
      const id = ageGroupRefId(s)
      if (id) referenced.add(id)
    }
  }
  // No per-age-group references → the session covers the camp's full range.
  if (referenced.size === 0) return fullRange

  // A camp group may be referenced by its stored id, legacy `ageGroupId`, or the
  // canonical `${min}-${max}` key, so match against any of them.
  const restricted = valid
    .filter(g => {
      if (g.id != null && referenced.has(String(g.id))) return true
      if (g.ageGroupId != null && referenced.has(String(g.ageGroupId))) return true
      return referenced.has(`${g.min}-${g.max}`)
    })
    .map(g => ({ min: g.min, max: g.max }))

  return restricted.length ? restricted : fullRange
}

export function checkSkillGate(
  childSkills: ChildSkillInput[],
  gate: EligibilitySkillGate
): EligibilityFailure | null {
  const requiredLevel = gate.scaleLevels.find(l => l.value === gate.minimumLevelValue)
  // Misconfigured gate (required level not in scale) — provider-side validation
  // owns that; do not block a booking on it.
  if (!requiredLevel) return null

  const childSkill = childSkills.find(s => s.activityId === gate.activityId)
  const childLevel = childSkill
    ? gate.scaleLevels.find(l => l.value === childSkill.levelValue)
    : null
  if (childLevel && childLevel.order >= requiredLevel.order) return null

  return {
    code: 'skill_gate_not_met',
    message: `Requires ${gate.activityName ?? 'a minimum skill'} level of "${gate.minimumLevelValue}" or higher.`,
    activityId: gate.activityId,
    activityName: gate.activityName,
    requiredLevel: gate.minimumLevelValue,
    childLevel: childSkill?.levelValue ?? null,
  }
}

export function checkReadiness(
  child: EligibilityChildInput,
  camp: EligibilityCampInput
): EligibilityFailure[] {
  const failures: EligibilityFailure[] = []
  if (!hasDateOfBirth(child.dateOfBirth)) {
    failures.push({ code: 'dob_missing', message: "Add the child's date of birth to book." })
  }
  if (!hasEmergencyContact(child.emergencyContacts)) {
    failures.push({
      code: 'no_emergency_contact',
      message: 'Add at least one emergency contact to book.',
    })
  }
  if (camp.isResidential && !hasMedicalInfo(child.medicalInfo)) {
    failures.push({
      code: 'medical_required',
      message: 'Residential camps require medical information before booking.',
    })
  }
  return failures
}

/**
 * Reject when the child already holds a booking whose dates overlap the session
 * window [sessionStart, sessionEnd). Compared at UTC-date granularity and using
 * a half-open interval, so back-to-back sessions (one ends the day the next
 * starts) do NOT conflict. No-op (returns null) when there are no existing
 * bookings or the window can't be resolved, so callers that lack the data skip
 * the rule cleanly.
 */
export function checkExistingBookingOverlap(
  existingBookings: ExistingBookingRange[] | undefined,
  sessionStart: string | Date,
  sessionEnd: string | Date | null | undefined
): EligibilityFailure | null {
  if (!existingBookings?.length) return null
  const start = startOfUtcDay(sessionStart)
  const end = startOfUtcDay(sessionEnd)
  if (!start || !end) return null

  const overlaps = existingBookings.some(b => {
    const bStart = startOfUtcDay(b.startDate)
    const bEnd = startOfUtcDay(b.endDate)
    if (!bStart || !bEnd) return false
    return bStart.getTime() < end.getTime() && bEnd.getTime() > start.getTime()
  })
  if (!overlaps) return null

  return {
    code: 'existing_booking_same_dates',
    message: 'This child already has a booking that overlaps these dates.',
  }
}

/**
 * Full eligibility evaluation for one child against one camp/session. Returns
 * every failure (not just the first) so the UI can list all blockers at once.
 *
 * `extras` carries session/cross-booking context (session end + the child's
 * existing bookings) for the overlap rule; it's optional, so callers without
 * that data simply skip the rule.
 */
export function validateChildAgainstCamp(
  child: EligibilityChildInput,
  camp: EligibilityCampInput,
  sessionStart: string | Date,
  extras?: EligibilityExtras
): EligibilityResult {
  const failures: EligibilityFailure[] = [...checkReadiness(child, camp)]

  const gender = checkGenderEligibility(child.gender, camp.gender)
  if (gender) failures.push(gender)

  // Age is only meaningful when DOB is present (readiness already flags a
  // missing DOB).
  if (hasDateOfBirth(child.dateOfBirth)) {
    const age = checkAgeEligibility(child.dateOfBirth, camp.ageGroups, sessionStart)
    if (age) failures.push(age)
  }

  for (const gate of camp.skillGates ?? []) {
    const skill = checkSkillGate(child.skills, gate)
    if (skill) failures.push(skill)
  }

  const overlap = checkExistingBookingOverlap(
    extras?.existingBookings,
    sessionStart,
    extras?.sessionEnd
  )
  if (overlap) failures.push(overlap)

  return { childId: child.id, eligible: failures.length === 0, failures }
}
