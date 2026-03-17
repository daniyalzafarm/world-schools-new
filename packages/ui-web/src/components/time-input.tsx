'use client'

import React from 'react'
import { type TimeInputProps, TimeInput as HeroTimeInput } from '@heroui/react'
import { Clock } from 'lucide-react'
import { cn } from '../utils/cn'
import { mergeClassNames } from '../utils/merge-class-names'

export interface CustomTimeInputProps extends Omit<TimeInputProps, 'classNames'> {
  classNames?: TimeInputProps['classNames']
}

export const TimeInput: React.FC<CustomTimeInputProps> = ({
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
  ) satisfies TimeInputProps['classNames']

  return (
    <HeroTimeInput
      {...{ endContent: <Clock size={20} className="text-gray-500" />, ...props }}
      classNames={mergedClassNames}
    />
  )
}
