import { describe, it, expect } from 'vitest'
import {
  type EligibilityCampInput,
  type EligibilityChildInput,
  checkSkillGate,
  normalizeChildGender,
  validateChildAgainstCamp,
} from './booking-eligibility'

const SESSION_START = '2026-08-01'

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
