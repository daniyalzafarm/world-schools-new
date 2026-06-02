/**
 * Shared session-capacity logic. Pure and Prisma-free so the API (authoritative
 * overbooking guard inside the submit transaction) and the frontends (live
 * spots-remaining display) compute capacity identically — including the
 * per-age-group case the previous generic count ignored.
 *
 * Age-group identity: a session's `ageGroupSpots[].ageGroupId` references a camp
 * age group. Camp age groups are stored as `{min,max}` (sometimes with an
 * explicit id); the canonical id is `id` / `ageGroupId` when present, else the
 * `"min-max"` string (the convention used by the CSV importer and pricing).
 */
import { calculateAgeAtDate } from './date-validation'

export interface CapacityAgeGroup {
  id?: string | null
  ageGroupId?: string | null
  min: number
  max: number
}

export interface AgeGroupSpot {
  ageGroupId?: string | null
  age_group_id?: string | null
  spots: number
}

export interface SessionCapacityConfig {
  availabilityType: string // 'single' | 'age_group'
  totalSpots?: number | null
  ageGroupSpots?: AgeGroupSpot[] | null
}

export function ageGroupCanonicalId(group: CapacityAgeGroup): string {
  return String(group.id ?? group.ageGroupId ?? `${group.min}-${group.max}`)
}

function spotEntryId(spot: AgeGroupSpot): string {
  return String(spot.ageGroupId ?? spot.age_group_id ?? '')
}

/** Map of canonical age-group id → spot capacity for an age-group session. */
export function getAgeGroupSpotsMap(config: SessionCapacityConfig): Map<string, number> {
  const map = new Map<string, number>()
  for (const spot of config.ageGroupSpots ?? []) {
    const id = spotEntryId(spot)
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + (typeof spot.spots === 'number' ? spot.spots : 0))
  }
  return map
}

/** The canonical age-group id a child belongs to at `sessionStart`, or null. */
export function getChildAgeGroupId(
  dob: string | Date | null | undefined,
  ageGroups: CapacityAgeGroup[],
  sessionStart: string | Date
): string | null {
  const age = calculateAgeAtDate(dob, sessionStart)
  if (age === null) return null
  const match = ageGroups.find(g => age >= g.min && age <= g.max)
  return match ? ageGroupCanonicalId(match) : null
}

/** Total capacity across the session (sum of age-group spots, or totalSpots). Null = unlimited. */
export function totalCapacity(config: SessionCapacityConfig): number | null {
  if (config.availabilityType === 'single') {
    return config.totalSpots ?? null
  }
  const map = getAgeGroupSpotsMap(config)
  if (map.size === 0) return null
  let sum = 0
  for (const v of map.values()) sum += v
  return sum
}

export interface CapacityCheckInput {
  config: SessionCapacityConfig
  campAgeGroups: CapacityAgeGroup[]
  sessionStart: string | Date
  /** DOBs of children already holding a spot (request..completed) on this session. */
  existingChildDobs: (string | Date | null | undefined)[]
  /** DOBs of the children in the booking being committed. */
  incomingChildDobs: (string | Date | null | undefined)[]
}

export interface CapacityCheckResult {
  fits: boolean
  /** Remaining spots before the incoming children (single mode); null when unlimited or age-group. */
  remaining: number | null
  /** Populated when !fits. */
  message?: string
}

/**
 * Authoritative overbooking check. Handles both single-total and per-age-group
 * availability. Capacity == null (no cap configured) always fits.
 */
export function checkCapacityFit(input: CapacityCheckInput): CapacityCheckResult {
  const { config, campAgeGroups, sessionStart, existingChildDobs, incomingChildDobs } = input

  if (config.availabilityType !== 'age_group') {
    const capacity = config.totalSpots ?? null
    if (capacity == null) return { fits: true, remaining: null }
    const remaining = capacity - existingChildDobs.length
    const fits = existingChildDobs.length + incomingChildDobs.length <= capacity
    return {
      fits,
      remaining,
      message: fits
        ? undefined
        : `Session is now full. Only ${Math.max(0, remaining)} spot(s) remaining.`,
    }
  }

  // Age-group availability: enforce each affected group's cap independently.
  const spotsMap = getAgeGroupSpotsMap(config)
  if (spotsMap.size === 0) return { fits: true, remaining: null }

  const tally = (dobs: (string | Date | null | undefined)[]) => {
    const counts = new Map<string, number>()
    for (const dob of dobs) {
      const id = getChildAgeGroupId(dob, campAgeGroups, sessionStart)
      if (id == null) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }

  const existingByGroup = tally(existingChildDobs)
  const incomingByGroup = tally(incomingChildDobs)

  for (const [groupId, incomingCount] of incomingByGroup) {
    const cap = spotsMap.get(groupId)
    if (cap == null) continue // group without a configured cap → treat as unlimited
    const existing = existingByGroup.get(groupId) ?? 0
    if (existing + incomingCount > cap) {
      const remaining = Math.max(0, cap - existing)
      return {
        fits: false,
        remaining: null,
        message: `Only ${remaining} spot(s) remaining for the ${groupId} age group.`,
      }
    }
  }

  return { fits: true, remaining: null }
}
