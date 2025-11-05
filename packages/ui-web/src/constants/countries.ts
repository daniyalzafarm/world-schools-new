import worldCountries from 'world-countries'

// Use the actual type from world-countries package
export type Country = (typeof worldCountries)[0]

// Extract and sort country data from the world-countries package
export const COUNTRIES_DATA: Country[] = (worldCountries as Country[]).sort((a, b) =>
  a.name.common.localeCompare(b.name.common)
)

// For backward compatibility, also export just the names
export const COUNTRIES: string[] = COUNTRIES_DATA.map(country => country.name.common)

// Helper function to get country by name
export const getCountryByName = (name: string): Country | undefined =>
  COUNTRIES_DATA.find(country => country.name.common === name)

// Helper function to get country flag emoji
export const getCountryFlag = (name: string): string => {
  const country = getCountryByName(name)
  return country?.flag || '🏳️'
}
