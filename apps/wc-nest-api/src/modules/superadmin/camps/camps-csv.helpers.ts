import { CAMP_IMPORT_COLUMNS } from '@world-schools/wc-types'

const REQUIRED_KEYS = CAMP_IMPORT_COLUMNS.filter(c => c.required).map(c => c.key)

const VALID_TYPES = ['day', 'residential']
const VALID_GENDERS = ['coed', 'boys', 'girls']
const VALID_LOCATION_TYPES = ['provider', 'different']

/**
 * Validates a raw CSV row against required fields and value constraints.
 * Returns an error message string on failure, or null when the row is valid.
 */
export function validateCampCsvRow(row: Record<string, string>): string | null {
  // Check required fields are present
  for (const key of REQUIRED_KEYS) {
    if (!row[key]?.trim()) {
      return `Missing required field: ${key}`
    }
  }

  // Validate type enum
  const type = row['type']?.trim()
  if (!VALID_TYPES.includes(type)) {
    return `Invalid type: "${type}". Must be one of: ${VALID_TYPES.join(', ')}`
  }

  // Validate gender enum
  const gender = row['gender']?.trim()
  if (!VALID_GENDERS.includes(gender)) {
    return `Invalid gender: "${gender}". Must be one of: ${VALID_GENDERS.join(', ')}`
  }

  // Validate locationType if provided
  const locationType = row['locationType']?.trim()
  if (locationType && !VALID_LOCATION_TYPES.includes(locationType)) {
    return `Invalid locationType: "${locationType}". Must be one of: ${VALID_LOCATION_TYPES.join(', ')}`
  }

  // Validate locationType=different requires locationPlaceId
  if (locationType === 'different' && !row['locationPlaceId']?.trim()) {
    return `locationPlaceId is required when locationType is 'different'`
  }

  // Validate ageGroups format: "8-12,13-17"
  const ageGroupsRaw = row['ageGroups']?.trim()
  const ageGroupParts = ageGroupsRaw.split(',').map(s => s.trim())

  for (const part of ageGroupParts) {
    const match = /^(\d+)-(\d+)$/.exec(part)
    if (!match) {
      return `Invalid ageGroups format: "${part}". Each group must be in min-max format (e.g., 8-12).`
    }
    const min = parseInt(match[1], 10)
    const max = parseInt(match[2], 10)
    if (min < 4 || min > 17) {
      return `Invalid ageGroups: min age ${min} must be between 4 and 17`
    }
    if (max < 5 || max > 18) {
      return `Invalid ageGroups: max age ${max} must be between 5 and 18`
    }
    if (max <= min) {
      return `Invalid ageGroups: max age (${max}) must be greater than min age (${min})`
    }
  }

  // Validate no overlapping age groups
  if (ageGroupParts.length > 1) {
    const parsed = ageGroupParts.map(part => {
      const [mn, mx] = part.split('-').map(Number)
      return { min: mn, max: mx }
    })
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const g1 = parsed[i]
        const g2 = parsed[j]
        if (g1.min <= g2.max && g1.max >= g2.min) {
          return `Age groups overlap: ${g1.min}-${g1.max} and ${g2.min}-${g2.max}`
        }
      }
    }
  }

  // Validate languages not empty
  const languages = row['languages']?.trim()
  if (!languages) {
    return `Missing required field: languages`
  }

  // Validate activities not empty
  const activities = row['activities']?.trim()
  if (!activities) {
    return `Missing required field: activities`
  }

  return null
}

export interface ParsedAgeGroup {
  min: number
  max: number
}

export interface ParsedCampRow {
  name: string
  type: 'day' | 'residential'
  description: string
  gender: 'coed' | 'boys' | 'girls'
  ageGroups: ParsedAgeGroup[]
  languages: string[]
  activities: string[]
  // Optional
  slug?: string
  locationType: 'provider' | 'different'
  locationPlaceId?: string
  locationName?: string
  locationAddress?: string
}

/**
 * Coerces a validated raw CSV row into strongly-typed values.
 * Only call after validateCampCsvRow returns null.
 */
export function parseCampCsvRow(row: Record<string, string>): ParsedCampRow {
  const str = (key: string): string | undefined => row[key]?.trim() || undefined

  // Parse ageGroups: "8-12,13-17" → [{min:8,max:12},{min:13,max:17}]
  const ageGroupsRaw = row['ageGroups'].trim()
  const ageGroups: ParsedAgeGroup[] = ageGroupsRaw.split(',').map(part => {
    const [mn, mx] = part.trim().split('-').map(Number)
    return { min: mn, max: mx }
  })

  // Parse comma-separated arrays
  const languages = row['languages']
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const activities = row['activities']
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const rawLocationType = row['locationType']?.trim()
  const locationType: 'provider' | 'different' =
    rawLocationType === 'different' ? 'different' : 'provider'

  return {
    name: row['name'].trim(),
    type: row['type'].trim() as 'day' | 'residential',
    description: row['description'].trim(),
    gender: row['gender'].trim() as 'coed' | 'boys' | 'girls',
    ageGroups,
    languages,
    activities,
    slug: str('slug'),
    locationType,
    locationPlaceId: str('locationPlaceId'),
    locationName: str('locationName'),
    locationAddress: str('locationAddress'),
  }
}

/**
 * Generates a URL-safe slug from a camp name.
 */
export function generateCampSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 150)
}
