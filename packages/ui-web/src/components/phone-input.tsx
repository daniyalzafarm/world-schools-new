'use client'

import { forwardRef, useMemo } from 'react'
import PhoneInputWithCountry, { type Country } from 'react-phone-number-input'
import { cn } from '../utils/cn'

interface PhoneInputProps {
  value?: string
  onChange?: (value: string | undefined) => void
  disabled?: boolean
  placeholder?: string
  defaultCountry?: Country
  error?: string
  className?: string
  label?: string
  isRequired?: boolean
  classNames?: {
    wrapper?: string
    inputWrapper?: string
  }
}

/**
 * PhoneInput component that handles international phone numbers with proper autofill support.
 *
 * Features:
 * - Automatic country code detection
 * - Browser autofill compatibility (handles full phone numbers in E.164 format)
 * - International phone number validation
 * - Integrates with react-hook-form
 * - Consistent API with HeroUI Input component (label, isRequired props)
 *
 * The component uses react-phone-number-input which is built on libphonenumber-js,
 * providing robust phone number parsing and validation for 200+ countries.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      disabled,
      placeholder = 'Phone number',
      defaultCountry = 'CH',
      error,
      className,
      label = '',
      isRequired = false,
      classNames,
    },
    ref
  ) => {
    // Memoize the input component to prevent recreation on every render
    // This is critical to maintain focus while typing
    const InputComponent = useMemo(
      () =>
        forwardRef<HTMLInputElement>((props, inputRef) => (
          <input {...props} ref={inputRef || ref} />
        )),
      [ref]
    )

    return (
      <div className={cn(className, classNames?.wrapper)}>
        {/* Label - matches HeroUI Input with labelPlacement="outside" */}
        {label && (
          <label className="mb-1 block text-sm font-medium text-foreground">
            {label}
            {isRequired && <span className="ml-1 text-danger">*</span>}
          </label>
        )}

        <PhoneInputWithCountry
          international
          defaultCountry={defaultCountry}
          value={value as any}
          onChange={val => onChange?.(val as string | undefined)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn('phone-input-wrapper', classNames?.inputWrapper, error && 'has-error')}
          inputComponent={InputComponent}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'
