/**
 * String formatting utilities for World Camps applications
 */

/**
 * Converts a snake_case string to Title Case with spaces
 * @param str - The snake_case string to format
 * @returns Formatted string in Title Case
 * @example
 * formatSnakeCaseToTitleCase('incomplete_information') // 'Incomplete Information'
 * formatSnakeCaseToTitleCase('invalid_documents') // 'Invalid Documents'
 */
export function formatSnakeCaseToTitleCase(str: string): string {
  if (!str) return ''

  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const HAS_LETTERS = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF]/
const STATE_CODE = /^[A-Z]{2,3}$/
const STREET_SUFFIX =
  /\b(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Hwy|Highway|Pkwy|Parkway|Strasse|Stra(ss|ß)e|Rue|Avenida|Calle|Via)\b/i

function cleanAddressSegment(segment: string): string {
  return segment
    .replace(/^\d[\d-]*\s+/, '')
    .replace(/\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/, '')
    .replace(/\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d$/, '')
    .replace(/\s+\d{5}(-\d{4})?$/, '')
    .replace(/\s+[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/, '')
    .replace(/\s+\d[\d-]*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isCityCandidate(cleaned: string): boolean {
  return (
    !!cleaned &&
    HAS_LETTERS.test(cleaned) &&
    !STATE_CODE.test(cleaned) &&
    !STREET_SUFFIX.test(cleaned)
  )
}

/**
 * Extracts the city name from a Google Places-style formatted address,
 * stripping postal codes (CH/EU prefix, US ZIP, UK, Canadian, JP), US-style
 * state codes, and the trailing country segment.
 *
 * @example
 * extractCityFromAddress('1094 Paudex, Switzerland') // 'Paudex'
 * extractCityFromAddress('Rue X 3, 1094 Paudex, Vaud, Switzerland') // 'Paudex'
 * extractCityFromAddress('123 Main St, Boston, MA 02115, USA') // 'Boston'
 * extractCityFromAddress('10 Downing St, London SW1A 2AA, UK') // 'London'
 */
export function extractCityFromAddress(address: string | null | undefined): string {
  if (!address) return ''

  const segments = address
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (segments.length === 0) return ''
  if (segments.length === 1) return cleanAddressSegment(segments[0])

  const candidates = segments.slice(0, -1)

  // Pass 1: prefer the rightmost candidate where cleaning actually stripped
  // a postal code — strong signal it's a "POSTAL CITY" or "CITY POSTAL" segment.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const original = candidates[i]
    const cleaned = cleanAddressSegment(original)
    if (cleaned !== original && isCityCandidate(cleaned)) {
      return cleaned
    }
  }

  // Pass 2: rightmost plain-text candidate (no postal, but a real city name).
  for (let i = candidates.length - 1; i >= 0; i--) {
    const cleaned = cleanAddressSegment(candidates[i])
    if (isCityCandidate(cleaned)) {
      return cleaned
    }
  }

  return (
    cleanAddressSegment(candidates[candidates.length - 1] ?? '') ||
    cleanAddressSegment(segments[segments.length - 1] ?? '')
  )
}
