'use client'

import React, { forwardRef } from 'react'
import PhoneInputWithCountry, { type Country } from 'react-phone-number-input'

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
      label = 'Phone Number',
      isRequired = false,
    },
    ref
  ) => {
    return (
      <div className={className}>
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
          className={`phone-input-wrapper ${error ? 'has-error' : ''}`}
          inputComponent={React.forwardRef<HTMLInputElement>((props, inputRef) => (
            <input {...props} ref={inputRef || ref} />
          ))}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'
