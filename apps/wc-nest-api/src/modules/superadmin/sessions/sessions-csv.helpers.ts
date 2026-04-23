const VALID_PRICING_TYPES = ['single', 'age_group']
const VALID_AVAILABILITY_TYPES = ['single', 'age_group']
const VALID_SESSION_DAY_TYPES = ['full_day', 'half_day']
const VALID_STATUSES = ['draft', 'published']
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

/**
 * Validates a raw CSV row for session import.
 * Returns an error message string on failure, or null when the row is valid.
 */
export function validateSessionCsvRow(
  row: Record<string, string>,
  campType: string
): string | null {
  // ── Required string fields ──────────────────────────────────────────────────
  const name = row['name']?.trim()
  if (!name) return 'Missing required field: name'
  if (name.length > 60) return `name exceeds 60 characters (got ${name.length})`

  const startDateRaw = row['startDate']?.trim()
  if (!startDateRaw) return 'Missing required field: startDate'
  if (!DATE_REGEX.test(startDateRaw) || isNaN(new Date(startDateRaw).getTime())) {
    return `Invalid startDate: "${startDateRaw}". Use YYYY-MM-DD format.`
  }

  const endDateRaw = row['endDate']?.trim()
  if (!endDateRaw) return 'Missing required field: endDate'
  if (!DATE_REGEX.test(endDateRaw) || isNaN(new Date(endDateRaw).getTime())) {
    return `Invalid endDate: "${endDateRaw}". Use YYYY-MM-DD format.`
  }

  const startDate = new Date(startDateRaw)
  const endDate = new Date(endDateRaw)
  if (endDate <= startDate) {
    return `endDate (${endDateRaw}) must be after startDate (${startDateRaw})`
  }

  // ── Pricing ─────────────────────────────────────────────────────────────────
  const pricingType = row['pricingType']?.trim()
  if (!pricingType) return 'Missing required field: pricingType'
  if (!VALID_PRICING_TYPES.includes(pricingType)) {
    return `Invalid pricingType: "${pricingType}". Must be one of: ${VALID_PRICING_TYPES.join(', ')}`
  }

  if (pricingType === 'single') {
    const priceRaw = row['price']?.trim()
    if (!priceRaw) return "price is required when pricingType is 'single'"
    const price = Number(priceRaw)
    if (isNaN(price) || price < 0) {
      return `Invalid price: "${priceRaw}". Must be a number ≥ 0.`
    }
    if (price > 1_000_000) {
      return `price exceeds maximum allowed value of 1,000,000`
    }
  }

  if (pricingType === 'age_group') {
    const raw = row['ageGroupPrices']?.trim()
    if (!raw) return "ageGroupPrices is required when pricingType is 'age_group'"
    const parseError = validateAgeGroupCompact(raw, 'ageGroupPrices', 'price')
    if (parseError) return parseError
  }

  // ── Availability ────────────────────────────────────────────────────────────
  const availabilityType = row['availabilityType']?.trim()
  if (!availabilityType) return 'Missing required field: availabilityType'
  if (!VALID_AVAILABILITY_TYPES.includes(availabilityType)) {
    return `Invalid availabilityType: "${availabilityType}". Must be one of: ${VALID_AVAILABILITY_TYPES.join(', ')}`
  }

  if (availabilityType === 'single') {
    const spotsRaw = row['totalSpots']?.trim()
    if (!spotsRaw) return "totalSpots is required when availabilityType is 'single'"
    const spots = Number(spotsRaw)
    if (!Number.isInteger(spots) || spots < 1) {
      return `Invalid totalSpots: "${spotsRaw}". Must be an integer ≥ 1.`
    }
    if (spots > 10_000) {
      return `totalSpots exceeds maximum allowed value of 10,000`
    }
  }

  if (availabilityType === 'age_group') {
    const raw = row['ageGroupSpots']?.trim()
    if (!raw) return "ageGroupSpots is required when availabilityType is 'age_group'"
    const parseError = validateAgeGroupCompact(raw, 'ageGroupSpots', 'spots')
    if (parseError) return parseError
  }

  // ── Session day type (day camps only) ──────────────────────────────────────
  const sessionDayType = row['sessionDayType']?.trim()
  if (sessionDayType) {
    if (campType !== 'day') {
      return `sessionDayType is only applicable to day camps`
    }
    if (!VALID_SESSION_DAY_TYPES.includes(sessionDayType)) {
      return `Invalid sessionDayType: "${sessionDayType}". Must be one of: ${VALID_SESSION_DAY_TYPES.join(', ')}`
    }

    if (sessionDayType === 'half_day') {
      const arrivalTime = row['arrivalTime']?.trim()
      const departureTime = row['departureTime']?.trim()

      if (!arrivalTime) return "arrivalTime is required when sessionDayType is 'half_day'"
      if (!TIME_REGEX.test(arrivalTime)) {
        return `Invalid arrivalTime: "${arrivalTime}". Use HH:MM format (e.g. 09:00).`
      }

      if (!departureTime) return "departureTime is required when sessionDayType is 'half_day'"
      if (!TIME_REGEX.test(departureTime)) {
        return `Invalid departureTime: "${departureTime}". Use HH:MM format (e.g. 13:00).`
      }

      const [arrH, arrM] = arrivalTime.split(':').map(Number)
      const [depH, depM] = departureTime.split(':').map(Number)
      if (depH * 60 + depM <= arrH * 60 + arrM) {
        return `departureTime (${departureTime}) must be after arrivalTime (${arrivalTime})`
      }
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  const status = row['status']?.trim()
  if (status && !VALID_STATUSES.includes(status)) {
    return `Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`
  }

  return null
}

/**
 * Validates the compact age-group format: "8-12:1200,13-17:1500"
 */
function validateAgeGroupCompact(
  raw: string,
  fieldName: string,
  valueLabel: 'price' | 'spots'
): string | null {
  const pairs = raw.split(',').map(s => s.trim())
  if (pairs.length < 2) {
    return `${fieldName} must have at least 2 age groups (e.g. 8-12:1200,13-17:1500)`
  }
  for (const pair of pairs) {
    const colonIdx = pair.lastIndexOf(':')
    if (colonIdx === -1) {
      return `${fieldName}: invalid format "${pair}". Expected ageGroupId:${valueLabel} (e.g. 8-12:1200)`
    }
    const ageGroupId = pair.substring(0, colonIdx).trim()
    const valueStr = pair.substring(colonIdx + 1).trim()

    if (!/^\d+-\d+$/.test(ageGroupId)) {
      return `${fieldName}: invalid age group ID "${ageGroupId}". Expected format min-max (e.g. 8-12)`
    }

    const value = Number(valueStr)
    if (isNaN(value)) {
      return `${fieldName}: invalid ${valueLabel} "${valueStr}" for age group ${ageGroupId}`
    }
    if (valueLabel === 'price' && value < 0) {
      return `${fieldName}: price for age group ${ageGroupId} must be ≥ 0`
    }
    if (valueLabel === 'spots' && (!Number.isInteger(value) || value < 1)) {
      return `${fieldName}: spots for age group ${ageGroupId} must be an integer ≥ 1`
    }
  }
  return null
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAgeGroupPrice {
  ageGroupId: string
  price: number
}

export interface ParsedAgeGroupSpot {
  ageGroupId: string
  spots: number
}

export interface ParsedSessionRow {
  name: string
  startDate: Date
  endDate: Date
  pricingType: 'single' | 'age_group'
  price?: number
  ageGroupPrices?: ParsedAgeGroupPrice[]
  availabilityType: 'single' | 'age_group'
  totalSpots?: number
  ageGroupSpots?: ParsedAgeGroupSpot[]
  sessionDayType?: 'full_day' | 'half_day'
  arrivalTime?: string
  departureTime?: string
  status: 'draft' | 'published'
}

/**
 * Coerces a validated CSV row into strongly-typed values.
 * Only call after validateSessionCsvRow returns null.
 */
export function parseSessionCsvRow(row: Record<string, string>): ParsedSessionRow {
  const str = (key: string): string | undefined => row[key]?.trim() || undefined

  const pricingType = row['pricingType'].trim() as 'single' | 'age_group'
  const availabilityType = row['availabilityType'].trim() as 'single' | 'age_group'

  let price: number | undefined
  let ageGroupPrices: ParsedAgeGroupPrice[] | undefined

  if (pricingType === 'single') {
    price = Number(row['price'].trim())
  } else {
    ageGroupPrices = row['ageGroupPrices'].split(',').map(pair => {
      const colonIdx = pair.lastIndexOf(':')
      return {
        ageGroupId: pair.substring(0, colonIdx).trim(),
        price: Number(pair.substring(colonIdx + 1).trim()),
      }
    })
  }

  let totalSpots: number | undefined
  let ageGroupSpots: ParsedAgeGroupSpot[] | undefined

  if (availabilityType === 'single') {
    totalSpots = Number(row['totalSpots'].trim())
  } else {
    ageGroupSpots = row['ageGroupSpots'].split(',').map(pair => {
      const colonIdx = pair.lastIndexOf(':')
      return {
        ageGroupId: pair.substring(0, colonIdx).trim(),
        spots: Number(pair.substring(colonIdx + 1).trim()),
      }
    })
  }

  const rawDayType = str('sessionDayType')
  const sessionDayType =
    rawDayType === 'full_day' || rawDayType === 'half_day' ? rawDayType : undefined

  const arrivalTime = sessionDayType === 'half_day' ? str('arrivalTime') : undefined
  const departureTime = sessionDayType === 'half_day' ? str('departureTime') : undefined

  const rawStatus = str('status')
  const status: 'draft' | 'published' = rawStatus === 'draft' ? 'draft' : 'published'

  return {
    name: row['name'].trim(),
    startDate: new Date(row['startDate'].trim()),
    endDate: new Date(row['endDate'].trim()),
    pricingType,
    price,
    ageGroupPrices,
    availabilityType,
    totalSpots,
    ageGroupSpots,
    sessionDayType,
    arrivalTime,
    departureTime,
    status,
  }
}
