import { LANGUAGES, LEGACY_LANGUAGE_ID_TO_CODE, type LanguageEntry } from '@world-schools/wc-types'

/**
 * Single source of truth for language data on the frontend. The canonical
 * dataset (codes + names + flags) lives in `@world-schools/wc-types` so the
 * backend can share it for validation/migration; here we add lookup maps,
 * ready-to-use options, and resilient render helpers — mirroring countries.ts.
 *
 * The canonical stored value is the ISO 639-1 code (e.g. "en"); display values
 * (name, flag) are derived at render time via the helpers below.
 */
export type LanguageData = LanguageEntry

/** Normalized, name-sorted language dataset. */
export const LANGUAGES_DATA: LanguageData[] = [...LANGUAGES].sort((a, b) =>
  a.name.localeCompare(b.name)
)

/** Ready-to-use select options keyed by the canonical ISO code. */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = LANGUAGES_DATA.map(
  language => ({
    value: language.code,
    label: language.name,
  })
)

const BY_CODE = new Map(LANGUAGES_DATA.map(l => [l.code.toLowerCase(), l]))
const BY_NAME = new Map(LANGUAGES_DATA.map(l => [l.name.toLowerCase(), l]))
const BY_LEGACY_ID = new Map(
  Object.entries(LEGACY_LANGUAGE_ID_TO_CODE).map(([id, code]) => [id, BY_CODE.get(code)])
)

/** Look up a language by its ISO code. */
export const getLanguageByCode = (code?: string | null): LanguageData | undefined =>
  code ? BY_CODE.get(code.toLowerCase()) : undefined

/**
 * Resolve a stored value to a language. Resilient during the migration window —
 * accepts a canonical code, a legacy display name ("English"), or a legacy
 * lowercase id ("english").
 */
const resolve = (codeOrLegacy?: string | null): LanguageData | undefined => {
  if (!codeOrLegacy) return undefined
  const key = codeOrLegacy.toLowerCase()
  return BY_CODE.get(key) ?? BY_NAME.get(key) ?? BY_LEGACY_ID.get(key)
}

/** Display name for a stored value; falls back to the raw value if unknown (e.g. a custom language). */
export const getLanguageName = (codeOrLegacy?: string | null): string =>
  resolve(codeOrLegacy)?.name ?? codeOrLegacy ?? ''

/** Flag emoji for a stored value; falls back to a neutral flag if unknown. */
export const getLanguageFlag = (codeOrLegacy?: string | null): string =>
  resolve(codeOrLegacy)?.flag ?? '🏳️'

/**
 * Normalize a value (ISO code, legacy name, or legacy id) to its canonical ISO
 * code. Returns '' when unresolvable. Use on the write side when pre-filling a
 * picker from a possibly-legacy value.
 */
export const getLanguageCode = (codeOrLegacy?: string | null): string =>
  resolve(codeOrLegacy)?.code ?? ''
