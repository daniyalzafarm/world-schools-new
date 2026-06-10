'use client'

import React from 'react'
import { Textarea as HeroTextarea, type TextAreaProps } from '@heroui/react'
import { cn } from '../utils/cn'
import { mergeClassNames } from '../utils/merge-class-names'

export interface CustomTextareaProps extends Omit<TextAreaProps, 'classNames'> {
  classNames?: TextAreaProps['classNames']
  showCharacterCount?: boolean
  minLength?: number
}

export const Textarea: React.FC<CustomTextareaProps> = ({
  classNames: customClassNames,
  showCharacterCount = false,
  minLength,
  value,
  maxLength,
  ...props
}) => {
  const mergedClassNames = mergeClassNames(
    {
      inputWrapper: cn(
        'rounded-lg bg-white',
        'border border-gray-200',
        'hover:border-gray-300',
        'focus-within:border-primary!',
        'focus-within:!bg-white',
        'focus-within:outline-none',
        'dark:border-gray-600'
      ),
      input: cn(),
    },
    customClassNames
  ) satisfies TextAreaProps['classNames']

  // Calculate character count
  const currentLength = typeof value === 'string' ? value.length : 0
  const percentage = maxLength ? (currentLength / maxLength) * 100 : 0
  const isNearLimit = percentage >= 90
  const isOverLimit = maxLength ? currentLength > maxLength : false
  const isAtLimit = maxLength ? currentLength >= maxLength : false
  const isBelowMinimum = minLength ? currentLength < minLength : false

  // Determine color based on state
  const getCountColor = () => {
    if (isOverLimit) return 'text-danger'
    if (isNearLimit) return 'text-warning-600'
    if (isBelowMinimum) return 'text-danger'
    return 'text-default-500'
  }

  return (
    <div>
      <HeroTextarea
        {...{ labelPlacement: 'outside', ...props }}
        value={value}
        maxLength={maxLength}
        classNames={mergedClassNames}
      />

      {showCharacterCount && maxLength && (
        <div className={cn('text-right text-sm', props.description ? '-mt-5' : 'mt-2')}>
          <span className={getCountColor()}>{currentLength}</span>
          <span className="text-default-500"> / {maxLength} characters</span>
          {minLength && <span className="text-default-500"> (minimum {minLength})</span>}
        </div>
      )}

      {showCharacterCount && maxLength && isAtLimit && (
        <p className="mt-1 text-right text-sm text-danger">
          Maximum {maxLength} characters reached
        </p>
      )}
    </div>
  )
}
