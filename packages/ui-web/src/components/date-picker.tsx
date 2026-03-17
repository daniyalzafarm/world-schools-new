'use client'

import React from 'react'
import { type DatePickerProps, DatePicker as HeroDatePicker } from '@heroui/react'
import { cn } from '../utils/cn'
import { mergeClassNames } from '../utils/merge-class-names'

export interface CustomDatePickerProps extends Omit<DatePickerProps, 'classNames'> {
  classNames?: DatePickerProps['classNames']
}

export const DatePicker: React.FC<CustomDatePickerProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = mergeClassNames(
    {
      base: cn('w-full'),
      inputWrapper: cn(
        'rounded-lg bg-white',
        'border border-gray-200',
        'hover:border-gray-300',
        'focus-within:border-primary!',
        'focus-within:bg-white!',
        'dark:border-gray-600',
        props.isInvalid && 'border-red-500'
      ),
      input: cn(),
    },
    customClassNames
  ) satisfies DatePickerProps['classNames']

  return <HeroDatePicker {...props} classNames={mergedClassNames} />
}
