import worldCountries from 'world-countries'

/**
 * Single source of truth for country data across the monorepo.
 *
 * Derived from the `world-countries` package and normalized into a flat,
 * strongly-typed shape. The canonical value stored everywhere (DB, API,
 * form state) is the ISO 3166-1 alpha-2 `code` (e.g. "CH"); display values
 * (name, flag, demonym) are derived at render time via the helpers below.
 */
export interface CountryData {
  /** ISO 3166-1 alpha-2 — the canonical stored value (e.g. "CH") */
  code: string
  /** ISO 3166-1 alpha-3 (e.g. "CHE") */
  cca3: string
  /** Common display name (e.g. "Switzerland") */
  name: string
  /** Official name (e.g. "Swiss Confederation") */
  officialName: string
  /** Emoji flag (e.g. "🇨🇭") */
  flag: string
  /** International dialing code when unambiguous (e.g. "+41"), else just the root */
  dialCode: string
  /** English demonym, used for nationality (e.g. "Swiss") */
  demonym: string
  /** World region (e.g. "Europe") */
  region: string
}

type RawCountry = (typeof worldCountries)[number]

/**
 * The raw `world-countries` record type. Kept exported for backward
 * compatibility with any consumer that referenced the previous `Country` type.
 */
export type Country = RawCountry

const buildDialCode = (idd: RawCountry['idd']): string => {
  if (!idd?.root) return ''
  // Only append the suffix when it's unambiguous (a single suffix).
  return idd.suffixes?.length === 1 ? `${idd.root}${idd.suffixes[0]}` : idd.root
}

/**
 * Derive the emoji flag from an ISO2 code by mapping each letter to its Unicode
 * regional-indicator symbol. Used as a fallback for the few records where
 * `world-countries` ships an empty `flag` (currently only BQ, Caribbean
 * Netherlands), so every country renders a flag.
 */
const flagFromCode = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[A-Z]/g, char => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))

const buildFlag = (country: RawCountry): string => country.flag || flagFromCode(country.cca2)

/** Normalized, name-sorted country dataset — the single source of truth. */
export const COUNTRIES_DATA: CountryData[] = (worldCountries as RawCountry[])
  .map(country => ({
    code: country.cca2,
    cca3: country.cca3,
    name: country.name.common,
    officialName: country.name.official,
    flag: buildFlag(country),
    dialCode: buildDialCode(country.idd),
    demonym: country.demonyms?.eng?.m ?? country.demonyms?.eng?.f ?? '',
    region: country.region,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** Country display names — kept for backward compatibility. */
export const COUNTRIES: string[] = COUNTRIES_DATA.map(country => country.name)

/** Ready-to-use select options keyed by the canonical ISO2 code. */
export const COUNTRY_OPTIONS: { value: string; label: string }[] = COUNTRIES_DATA.map(country => ({
  value: country.code,
  label: country.name,
}))

/**
 * Nationality select options keyed by the canonical ISO2 `code`, labeled by
 * demonym with a flag prefix, and sorted alphabetically by demonym.
 *
 * Two data quirks are handled here so consumers don't have to:
 * - A handful of `world-countries` records have an empty `flag` (e.g. BQ,
 *   Caribbean Netherlands), so the flag is only prefixed when present —
 *   otherwise the label would start with a stray space and sort to the top.
 * - Several demonyms are shared by more than one country (e.g. "Indian" for
 *   India and the British Indian Ocean Territory). Those are disambiguated with
 *   the country name so every entry is distinguishable rather than appearing as
 *   visually identical duplicates.
 */
export const NATIONALITY_OPTIONS: { value: string; label: string }[] = (() => {
  const withDemonym = COUNTRIES_DATA.filter(country => country.demonym)
  const demonymCounts = withDemonym.reduce<Record<string, number>>((counts, country) => {
    counts[country.demonym] = (counts[country.demonym] ?? 0) + 1
    return counts
  }, {})
  return withDemonym
    .slice()
    .sort((a, b) => a.demonym.localeCompare(b.demonym) || a.name.localeCompare(b.name))
    .map(country => {
      const flagPrefix = country.flag ? `${country.flag} ` : ''
      const label =
        demonymCounts[country.demonym] > 1
          ? `${flagPrefix}${country.demonym} (${country.name})`
          : `${flagPrefix}${country.demonym}`
      return { value: country.code, label }
    })
})()

const BY_CODE = new Map(COUNTRIES_DATA.map(c => [c.code.toUpperCase(), c]))
const BY_NAME = new Map(COUNTRIES_DATA.map(c => [c.name.toLowerCase(), c]))

/** Look up a country by its ISO2 code. */
export const getCountryByCode = (code?: string | null): CountryData | undefined =>
  code ? BY_CODE.get(code.toUpperCase()) : undefined

/** Look up a country by its common display name (legacy / SQL-migration fallback). */
export const getCountryByName = (name?: string | null): CountryData | undefined =>
  name ? BY_NAME.get(name.toLowerCase()) : undefined

/**
 * Resolve a stored value (ISO2 code, or a legacy display name) to a country.
 * Resilient during the name→code migration window.
 */
const resolve = (codeOrName?: string | null): CountryData | undefined =>
  getCountryByCode(codeOrName) ?? getCountryByName(codeOrName)

/** Display name for a stored value; falls back to the raw value if unknown. */
export const getCountryName = (codeOrName?: string | null): string =>
  resolve(codeOrName)?.name ?? codeOrName ?? ''

/** Emoji flag for a stored value; falls back to a neutral flag if unknown. */
export const getCountryFlag = (codeOrName?: string | null): string =>
  resolve(codeOrName)?.flag ?? '🏳️'

/** Demonym for a stored value (nationality display); falls back to the raw value. */
export const getCountryDemonym = (codeOrName?: string | null): string =>
  resolve(codeOrName)?.demonym ?? codeOrName ?? ''

/**
 * Normalize a value (ISO2 code, or a legacy display name) to its canonical ISO2
 * code. Returns '' when unresolvable. Use on the write side when pre-filling a
 * country picker from a possibly-legacy value (e.g. a name from an external API).
 */
export const getCountryCode = (codeOrName?: string | null): string =>
  resolve(codeOrName)?.code ?? ''
