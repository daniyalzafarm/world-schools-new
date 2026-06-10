'use client'

import Select, { type MultiValue } from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { LANGUAGES_DATA, getLanguageName } from '../constants/languages'
import { selectFieldClassNames, selectFieldPortalStyles } from '../utils/react-select-styles'
import { cn } from '../utils/cn'

/**
 * Shared, searchable multi-select language picker. The canonical value is the
 * ISO 639-1 code; options render `flag + name` from the language source of
 * truth. Built on react-select (HeroUI's Autocomplete is single-select only)
 * and styled with the shared `selectFieldClassNames` so it matches the house
 * look used elsewhere.
 */

interface LanguageOption {
  value: string
  label: string
}

const LANGUAGE_SELECT_OPTIONS: LanguageOption[] = LANGUAGES_DATA.map(language => ({
  value: language.code,
  label: `${language.flag} ${language.name}`,
}))

export interface LanguageSelectProps {
  /** Selected ISO 639-1 codes (plus any custom free-text values when allowCustom). */
  value: string[]
  onChange: (codes: string[]) => void
  label?: string
  placeholder?: string
  isRequired?: boolean
  isDisabled?: boolean
  isInvalid?: boolean
  errorMessage?: string
  /** Allow typing custom languages not in the dataset (e.g. camp "Languages Offered"). */
  allowCustom?: boolean
  className?: string
  /** Stable id for the underlying input (accessibility / label association). */
  inputId?: string
}

export function LanguageSelect({
  value,
  onChange,
  label,
  placeholder = 'Add language',
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  allowCustom,
  className,
  inputId,
}: LanguageSelectProps) {
  // Map stored codes back to options; build a passthrough option for any value
  // not in the dataset (legacy or custom) so it still renders as a chip.
  const selected: LanguageOption[] = value.map(
    code =>
      LANGUAGE_SELECT_OPTIONS.find(option => option.value === code) ?? {
        value: code,
        label: getLanguageName(code) || code,
      }
  )

  // CreatableSelect shares react-select's base props; cast keeps one render path.
  const SelectComponent = (allowCustom ? CreatableSelect : Select) as typeof Select

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-900 dark:text-white mb-2"
        >
          {label}
          {isRequired && <span className="text-danger"> *</span>}
        </label>
      )}
      <SelectComponent<LanguageOption, true>
        inputId={inputId}
        isMulti
        unstyled
        menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        // Flip above the input automatically when there isn't room below (e.g.
        // near the bottom of the page) and don't scroll the page on open, so the
        // dropdown overlays content instead of disturbing the layout.
        menuPlacement="auto"
        menuShouldScrollIntoView={false}
        styles={selectFieldPortalStyles<LanguageOption, true>()}
        classNames={selectFieldClassNames<LanguageOption, true>()}
        options={LANGUAGE_SELECT_OPTIONS}
        value={selected}
        onChange={(selectedOptions: MultiValue<LanguageOption>) =>
          onChange(selectedOptions.map(option => option.value))
        }
        placeholder={placeholder}
        isDisabled={isDisabled}
        aria-invalid={isInvalid}
      />
      {isInvalid && errorMessage && (
        <p className={cn('mt-1 text-xs text-danger')}>{errorMessage}</p>
      )}
    </div>
  )
}
