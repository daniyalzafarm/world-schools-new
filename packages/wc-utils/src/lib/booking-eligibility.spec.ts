import { describe, it, expect } from 'vitest'
import {
  type EligibilityCampInput,
  type EligibilityChildInput,
  checkExistingBookingOverlap,
  checkSkillGate,
  getSessionAgeGroups,
  normalizeChildGender,
  validateChildAgainstCamp,
} from './booking-eligibility'

const SESSION_START = '2026-08-01'
const SESSION_END = '2026-08-08'

const SWIM_SCALE = [
  { value: 'none', order: 1 },
  { value: 'beginner', order: 2 },
  { value: 'intermediate', order: 3 },
  { value: 'advanced', order: 4 },
]

function child(overrides: Partial<EligibilityChildInput> = {}): EligibilityChildInput {
  return {
    id: 'c1',
    dateOfBirth: '2015-01-01', // turns 11 before SESSION_START
    gender: 'male',
    emergencyContacts: [{ name: 'Mum', phone: '123' }],
    medicalInfo: { swimmingAbility: 'intermediate' },
    skills: [{ activityId: 'swim', levelValue: 'intermediate' }],
    ...overrides,
  }
}

function camp(overrides: Partial<EligibilityCampInput> = {}): EligibilityCampInput {
  return {
    gender: 'coed',
    ageGroups: [{ min: 8, max: 12 }],
    isResidential: false,
    skillGates: [],
    ...overrides,
  }
}

describe('normalizeChildGender', () => {
  it('maps common spellings', () => {
    expect(normalizeChildGender('Male')).toBe('male')
    expect(normalizeChildGender('boy')).toBe('male')
    expect(normalizeChildGender('F')).toBe('female')
    expect(normalizeChildGender('girl')).toBe('female')
  })
  it('returns other for unmappable and null for empty', () => {
    expect(normalizeChildGender('non-binary')).toBe('other')
    expect(normalizeChildGender('')).toBeNull()
    expect(normalizeChildGender(null)).toBeNull()
  })
})

describe('validateChildAgainstCamp — gender (strict)', () => {
  it('passes coed for any gender', () => {
    expect(
      validateChildAgainstCamp(child({ gender: 'other' }), camp(), SESSION_START).eligible
    ).toBe(true)
  })
  it('blocks a girl from a boys camp', () => {
    const res = validateChildAgainstCamp(
      child({ gender: 'female' }),
      camp({ gender: 'boys' }),
      SESSION_START
    )
    expect(res.eligible).toBe(false)
    expect(res.failures.map(f => f.code)).toContain('gender_mismatch')
  })
  it('blocks unspecified gender from a girls camp (strict)', () => {
    const res = validateChildAgainstCamp(
      child({ gender: null, dateOfBirth: '2015-01-01' }),
      camp({ gender: 'girls' }),
      SESSION_START
    )
    expect(res.failures.map(f => f.code)).toContain('gender_mismatch')
  })
  it('allows a matching gender', () => {
    expect(
      validateChildAgainstCamp(
        child({ gender: 'female' }),
        camp({ gender: 'girls' }),
        SESSION_START
      ).eligible
    ).toBe(true)
  })
})

describe('validateChildAgainstCamp — age', () => {
  it('blocks an under-age child', () => {
    const res = validateChildAgainstCamp(
      child({ dateOfBirth: '2020-01-01' }),
      camp(),
      SESSION_START
    )
    expect(res.failures.map(f => f.code)).toContain('age_out_of_range')
  })
  it('blocks an over-age child', () => {
    const res = validateChildAgainstCamp(
      child({ dateOfBirth: '2005-01-01' }),
      camp(),
      SESSION_START
    )
    expect(res.failures.map(f => f.code)).toContain('age_out_of_range')
  })
  it('passes a child at the boundary', () => {
    // Turns 12 on 2026-07-01, before the 2026-08-01 session.
    expect(
      validateChildAgainstCamp(child({ dateOfBirth: '2014-07-01' }), camp(), SESSION_START).eligible
    ).toBe(true)
  })
})

describe('checkSkillGate', () => {
  const gate = {
    activityId: 'swim',
    activityName: 'Swimming',
    minimumLevelValue: 'intermediate',
    scaleLevels: SWIM_SCALE,
  }
  it('passes when child level >= required', () => {
    expect(checkSkillGate([{ activityId: 'swim', levelValue: 'advanced' }], gate)).toBeNull()
    expect(checkSkillGate([{ activityId: 'swim', levelValue: 'intermediate' }], gate)).toBeNull()
  })
  it('fails when child level is below required', () => {
    expect(checkSkillGate([{ activityId: 'swim', levelValue: 'beginner' }], gate)?.code).toBe(
      'skill_gate_not_met'
    )
  })
  it('fails when child has no skill for the activity', () => {
    expect(checkSkillGate([], gate)?.code).toBe('skill_gate_not_met')
  })
  it('does not block on a misconfigured gate (required level not in scale)', () => {
    expect(checkSkillGate([], { ...gate, minimumLevelValue: 'mythic' })).toBeNull()
  })
})

describe('validateChildAgainstCamp — readiness', () => {
  it('blocks when DOB missing (and skips age check)', () => {
    const res = validateChildAgainstCamp(child({ dateOfBirth: null }), camp(), SESSION_START)
    const codes = res.failures.map(f => f.code)
    expect(codes).toContain('dob_missing')
    expect(codes).not.toContain('age_out_of_range')
  })
  it('blocks when no emergency contact', () => {
    const res = validateChildAgainstCamp(child({ emergencyContacts: [] }), camp(), SESSION_START)
    expect(res.failures.map(f => f.code)).toContain('no_emergency_contact')
  })
  it('requires medical info only for residential camps', () => {
    const noMedical = child({ medicalInfo: null })
    expect(
      validateChildAgainstCamp(noMedical, camp({ isResidential: false }), SESSION_START).eligible
    ).toBe(true)
    const res = validateChildAgainstCamp(noMedical, camp({ isResidential: true }), SESSION_START)
    expect(res.failures.map(f => f.code)).toContain('medical_required')
  })
})

describe('checkExistingBookingOverlap', () => {
  it('returns null when there are no existing bookings', () => {
    expect(checkExistingBookingOverlap([], SESSION_START, SESSION_END)).toBeNull()
    expect(checkExistingBookingOverlap(undefined, SESSION_START, SESSION_END)).toBeNull()
  })
  it('returns null when the session end is missing', () => {
    expect(
      checkExistingBookingOverlap(
        [{ startDate: SESSION_START, endDate: SESSION_END }],
        SESSION_START,
        null
      )
    ).toBeNull()
  })
  it('flags an overlapping booking', () => {
    const res = checkExistingBookingOverlap(
      [{ startDate: '2026-08-05', endDate: '2026-08-12' }],
      SESSION_START,
      SESSION_END
    )
    expect(res?.code).toBe('existing_booking_same_dates')
  })
  it('flags an exact-same-dates booking', () => {
    const res = checkExistingBookingOverlap(
      [{ startDate: SESSION_START, endDate: SESSION_END }],
      SESSION_START,
      SESSION_END
    )
    expect(res?.code).toBe('existing_booking_same_dates')
  })
  it('allows a back-to-back booking (ends the day this one starts)', () => {
    expect(
      checkExistingBookingOverlap(
        [{ startDate: '2026-07-25', endDate: SESSION_START }],
        SESSION_START,
        SESSION_END
      )
    ).toBeNull()
  })
  it('allows bookings entirely before or after the session', () => {
    expect(
      checkExistingBookingOverlap(
        [{ startDate: '2026-06-01', endDate: '2026-06-08' }],
        SESSION_START,
        SESSION_END
      )
    ).toBeNull()
    expect(
      checkExistingBookingOverlap(
        [{ startDate: '2026-09-01', endDate: '2026-09-08' }],
        SESSION_START,
        SESSION_END
      )
    ).toBeNull()
  })
  it('compares at date granularity, ignoring time-of-day on DateTime values', () => {
    // Existing booking ends 2026-08-01T08:00; session starts 2026-08-01T00:00.
    // Same calendar day on the boundary → still no overlap (half-open).
    expect(
      checkExistingBookingOverlap(
        [{ startDate: '2026-07-25T09:00:00Z', endDate: '2026-08-01T08:00:00Z' }],
        '2026-08-01T00:00:00Z',
        '2026-08-08T00:00:00Z'
      )
    ).toBeNull()
  })
})

describe('validateChildAgainstCamp — existing booking overlap', () => {
  it('is eligible when no extras are passed (rule skipped)', () => {
    expect(validateChildAgainstCamp(child(), camp(), SESSION_START).eligible).toBe(true)
  })
  it('blocks a child with an overlapping existing booking', () => {
    const res = validateChildAgainstCamp(child(), camp(), SESSION_START, {
      sessionEnd: SESSION_END,
      existingBookings: [{ startDate: '2026-08-03', endDate: '2026-08-10' }],
    })
    expect(res.eligible).toBe(false)
    expect(res.failures.map(f => f.code)).toContain('existing_booking_same_dates')
  })
  it('stays eligible for a non-overlapping existing booking', () => {
    const res = validateChildAgainstCamp(child(), camp(), SESSION_START, {
      sessionEnd: SESSION_END,
      existingBookings: [{ startDate: '2026-09-01', endDate: '2026-09-08' }],
    })
    expect(res.eligible).toBe(true)
  })
})

describe('getSessionAgeGroups', () => {
  // iD Tech: camp spans 7–17 across three bands.
  const CAMP_AGE_GROUPS = [
    { min: 7, max: 9 },
    { min: 10, max: 13 },
    { min: 14, max: 17 },
  ]

  it('restricts to the band a session prices (e.g. "Ages 7-9")', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'age_group',
      availabilityType: 'age_group',
      ageGroupPrices: [{ ageGroupId: '7-9' }],
      ageGroupSpots: [{ ageGroupId: '7-9' }],
    })
    expect(groups).toEqual([{ min: 7, max: 9 }])
  })

  it('returns the full camp range for a single-price/single-availability session', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'single',
      availabilityType: 'single',
    })
    expect(groups).toEqual(CAMP_AGE_GROUPS)
  })

  it('returns the full range when a session prices every band', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'age_group',
      availabilityType: 'single',
      ageGroupPrices: [{ ageGroupId: '7-9' }, { ageGroupId: '10-13' }, { ageGroupId: '14-17' }],
    })
    expect(groups).toEqual(CAMP_AGE_GROUPS)
  })

  it('unions pricing and availability references', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'age_group',
      availabilityType: 'age_group',
      ageGroupPrices: [{ ageGroupId: '7-9' }],
      ageGroupSpots: [{ ageGroupId: '14-17' }],
    })
    expect(groups).toEqual([
      { min: 7, max: 9 },
      { min: 14, max: 17 },
    ])
  })

  it('accepts the stored snake_case age_group_id key', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'age_group',
      availabilityType: 'single',
      ageGroupPrices: [{ age_group_id: '10-13' }],
    })
    expect(groups).toEqual([{ min: 10, max: 13 }])
  })

  it('matches a camp group by its stored id when present', () => {
    const groups = getSessionAgeGroups(
      [
        { id: 'grp-a', min: 7, max: 9 },
        { id: 'grp-b', min: 10, max: 13 },
      ],
      {
        pricingType: 'age_group',
        availabilityType: 'single',
        ageGroupPrices: [{ ageGroupId: 'grp-b' }],
      }
    )
    expect(groups).toEqual([{ min: 10, max: 13 }])
  })

  it('falls back to the full range when references match no camp group', () => {
    const groups = getSessionAgeGroups(CAMP_AGE_GROUPS, {
      pricingType: 'age_group',
      availabilityType: 'single',
      ageGroupPrices: [{ ageGroupId: 'stale-id' }],
    })
    expect(groups).toEqual(CAMP_AGE_GROUPS)
  })

  it('returns the full range when the session is absent', () => {
    expect(getSessionAgeGroups(CAMP_AGE_GROUPS, null)).toEqual(CAMP_AGE_GROUPS)
  })
})

describe('validateChildAgainstCamp — per-session age band', () => {
  const CAMP_AGE_GROUPS = [
    { min: 7, max: 9 },
    { min: 10, max: 13 },
    { min: 14, max: 17 },
  ]
  // "Minecraft Game Design (Ages 7-9)" — offers only the 7–9 band.
  const session = {
    pricingType: 'age_group',
    availabilityType: 'age_group',
    ageGroupPrices: [{ ageGroupId: '7-9' }],
    ageGroupSpots: [{ ageGroupId: '7-9' }],
  }
  // Emma turns 12 before the session start — inside the camp's 7–17 range but
  // outside the selected session's 7–9 band.
  const emma = child({ dateOfBirth: '2014-01-01' })

  it('blocks a child inside the camp range but outside the session band', () => {
    const res = validateChildAgainstCamp(
      emma,
      { ...camp(), ageGroups: getSessionAgeGroups(CAMP_AGE_GROUPS, session) },
      SESSION_START
    )
    expect(res.eligible).toBe(false)
    expect(res.failures.map(f => f.code)).toContain('age_out_of_range')
  })

  it('would have passed against the camp-wide range (regression guard)', () => {
    const res = validateChildAgainstCamp(emma, camp({ ageGroups: CAMP_AGE_GROUPS }), SESSION_START)
    expect(res.eligible).toBe(true)
  })

  it('reports only the session band in the message (BUG-160)', () => {
    const res = validateChildAgainstCamp(
      emma,
      { ...camp(), ageGroups: getSessionAgeGroups(CAMP_AGE_GROUPS, session) },
      SESSION_START
    )
    const ageFailure = res.failures.find(f => f.code === 'age_out_of_range')
    expect(ageFailure?.message).toContain('7–9')
    expect(ageFailure?.message).not.toContain('10–13')
    expect(ageFailure?.message).not.toContain('14–17')
  })
})

describe('validateChildAgainstCamp — combined', () => {
  it('reports every failure at once', () => {
    const res = validateChildAgainstCamp(
      child({ gender: 'female', dateOfBirth: '2005-01-01', emergencyContacts: [] }),
      camp({ gender: 'boys' }),
      SESSION_START
    )
    expect(res.eligible).toBe(false)
    const codes = res.failures.map(f => f.code)
    expect(codes).toContain('gender_mismatch')
    expect(codes).toContain('age_out_of_range')
    expect(codes).toContain('no_emergency_contact')
  })
})
