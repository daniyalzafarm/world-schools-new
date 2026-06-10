'use client'

import type { Key } from 'react'
import { Autocomplete, AutocompleteItem, type AutocompleteProps } from '@heroui/react'
import { COUNTRIES_DATA, NATIONALITY_OPTIONS } from '../constants/countries'
import { cn } from '../utils/cn'

/**
 * Shared, searchable country / nationality dropdowns.
 *
 * Both wrap HeroUI's `Autocomplete` (the searchable "house style" used on the
 * provider onboarding page) so every country/nationality picker across the apps
 * looks and behaves identically. The canonical value is the ISO2 `code`; the
 * flag + name/demonym are rendered from the shared dataset.
 */

const DEFAULT_INPUT_WRAPPER =
  'rounded-lg bg-white border border-gray-200 hover:border-gray-300 focus-within:border-primary! focus-within:bg-white! dark:border-gray-600'

// Precomputed once at module scope — the underlying datasets are static.
// `textValue` keeps the flag so it shows in the selected input; HeroUI filters
// by "contains", so the emoji prefix doesn't interfere with searching by name.
const COUNTRY_ITEMS = COUNTRIES_DATA.map(country => {
  const label = `${country.flag} ${country.name}`
  return { key: country.code, label, textValue: label }
})

const NATIONALITY_ITEMS = NATIONALITY_OPTIONS.map(option => ({
  key: option.value,
  label: option.label,
  textValue: option.label,
}))

export interface CountrySelectProps {
  /** ISO 3166-1 alpha-2 code (canonical stored value). */
  value?: string | null
  /** Fires with the selected ISO2 code, or '' when cleared. */
  onChange: (code: string) => void
  label?: string
  placeholder?: string
  labelPlacement?: AutocompleteProps['labelPlacement']
  isRequired?: boolean
  isDisabled?: boolean
  isInvalid?: boolean
  errorMessage?: string
  /** Merged into the Autocomplete `base` slot. */
  className?: string
  /** Overrides the default input-wrapper styling (e.g. a dirty-state warning border). */
  inputWrapperClassName?: string
  name?: string
}

interface SearchableSelectProps extends CountrySelectProps {
  items: { key: string; label: string; textValue: string }[]
}

function SearchableSelect({
  value,
  onChange,
  label,
  placeholder,
  labelPlacement = 'outside',
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  className,
  inputWrapperClassName,
  name,
  items,
}: SearchableSelectProps) {
  return (
    <Autocomplete
      label={label}
      labelPlacement={labelPlacement}
      placeholder={placeholder}
      name={name}
      value={value ?? null}
      onChange={(key: Key | null) => onChange(key != null ? String(key) : '')}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      classNames={{
        base: cn('w-full', className),
        listboxWrapper: 'max-h-80',
      }}
      inputProps={{
        classNames: {
          inputWrapper: inputWrapperClassName ?? DEFAULT_INPUT_WRAPPER,
        },
      }}
    >
      {items.map(item => (
        <AutocompleteItem key={item.key} textValue={item.textValue}>
          {item.label}
        </AutocompleteItem>
      ))}
    </Autocomplete>
  )
}

/** Searchable country picker — options labeled `flag + name`, value = ISO2 code. */
export function CountrySelect(props: CountrySelectProps) {
  return <SearchableSelect {...props} items={COUNTRY_ITEMS} />
}

/** Searchable nationality picker — options labeled `flag + demonym`, value = ISO2 code. */
export function NationalitySelect(props: CountrySelectProps) {
  return <SearchableSelect {...props} items={NATIONALITY_ITEMS} />
}
